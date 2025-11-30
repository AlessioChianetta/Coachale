import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { getVertexAITokenForLive } from './provider-factory';
import { 
  convertWebMToPCM, 
  convertPCMToWAV, 
  base64ToBuffer,
  bufferToBase64 
} from './audio-converter';
import { db } from '../db';
import { aiConversations, aiMessages, aiWeeklyConsultations, vertexAiUsageTracking, clientSalesConversations, salesScripts } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';
import { storage } from '../storage';
import { buildUserContext } from '../ai-context-builder';
import { buildSystemPrompt } from '../ai-prompts';
import { buildSalesAgentPrompt, buildStaticSalesAgentPrompt, buildSalesAgentDynamicContext, buildMinimalSalesAgentInstruction, buildFullSalesAgentContext, buildFullSalesAgentContextAsync, ScriptPosition } from './sales-agent-prompt-builder';
import { getOrCreateTracker, removeTracker, SalesScriptTracker } from './sales-script-tracker';
import { createSalesLogger, SalesScriptLogger } from './sales-script-logger';
import { SalesManagerAgent } from './sales-manager-agent';
import type { SalesManagerParams, SalesManagerAnalysis, BusinessContext } from './sales-manager-agent';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📊 IN-MEMORY CACHE per Sessioni Attive
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Traccia le consulenze AI attualmente in corso per mostrare badge
 * "🟢 In Corso" nell'interfaccia del consulente.
 * 
 * TTL: 3 minuti (180000 ms) - previene stale badges tra autosave
 * Cleanup automatico: ogni 60 secondi rimuove entries scadute
 */

interface ActiveSessionEntry {
  timestamp: number;
  clientId: string;
}

const activeSessionsCache = new Map<string, ActiveSessionEntry>();
const SESSION_TTL_MS = 3 * 60 * 1000; // 3 minuti

/**
 * Cleanup automatico entries scadute ogni 60 secondi
 */
setInterval(() => {
  const now = Date.now();
  let removedCount = 0;
  
  for (const [consultationId, entry] of activeSessionsCache.entries()) {
    if (now - entry.timestamp > SESSION_TTL_MS) {
      activeSessionsCache.delete(consultationId);
      removedCount++;
    }
  }
  
  if (removedCount > 0) {
    console.log(`🧹 [CACHE CLEANUP] Removed ${removedCount} stale session(s) from cache`);
  }
}, 60 * 1000);

/**
 * Controlla se una consulenza è attualmente attiva
 * @param consultationId - ID della consulenza da controllare
 * @returns true se la sessione è attiva (entro TTL), false altrimenti
 */
export function isConsultationActive(consultationId: string): boolean {
  const entry = activeSessionsCache.get(consultationId);
  if (!entry) return false;
  
  const now = Date.now();
  const isActive = (now - entry.timestamp) <= SESSION_TTL_MS;
  
  if (!isActive) {
    // Rimuovi entry scaduta
    activeSessionsCache.delete(consultationId);
  }
  
  return isActive;
}

/**
 * Aggiorna timestamp per una sessione attiva (refresh TTL)
 * @param consultationId - ID della consulenza
 * @param clientId - ID del cliente
 */
function refreshSessionActivity(consultationId: string, clientId: string): void {
  activeSessionsCache.set(consultationId, {
    timestamp: Date.now(),
    clientId
  });
}

/**
 * Rimuove una sessione dalla cache (quando termina)
 * @param consultationId - ID della consulenza
 */
function removeActiveSession(consultationId: string): void {
  const wasActive = activeSessionsCache.delete(consultationId);
  if (wasActive) {
    console.log(`🔴 [CACHE] Session removed: ${consultationId}`);
  }
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎯 CENTRALIZED PHASE → SCRIPT TYPE MAPPING
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Maps conversation phases to script types.
 * Supports both named phases (discovery, demo) and numbered phases (phase_1_2).
 * 
 * Phase mapping rules:
 * - phase_1_* and phase_2_*: discovery
 * - phase_3_*: demo
 * - phase_4_*, phase_5_*, phase_6_*: objections/closing
 * - followup*, nurture*: objections
 * - Named phases: direct mapping (closing → objections)
 * 
 * @param phase - Current conversation phase
 * @param existingScriptType - Optional fallback for unknown phases (preserves existing value)
 */
function mapPhaseToScriptType(
  phase: string | null | undefined, 
  existingScriptType?: 'discovery' | 'demo' | 'objections' | string | null
): 'discovery' | 'demo' | 'objections' {
  if (!phase) {
    if (existingScriptType && ['discovery', 'demo', 'objections'].includes(existingScriptType)) {
      return existingScriptType as 'discovery' | 'demo' | 'objections';
    }
    return 'discovery';
  }
  
  const phaseLower = phase.toLowerCase();
  
  // Check if phase is in format phase_X_Y (numbered phases)
  const phaseMatch = phase.match(/^phase_(\d+)/);
  if (phaseMatch) {
    const phaseNum = parseInt(phaseMatch[1]);
    if (phaseNum <= 2) return 'discovery';
    else if (phaseNum === 3) return 'demo';
    else return 'objections'; // phase_4_*, phase_5_*, phase_6_* are objections/closing
  }
  
  // Check for followup patterns (any phase starting with "followup")
  if (phaseLower.startsWith('followup')) {
    return 'objections';
  }
  
  // Check for nurture patterns (any phase starting with "nurture")
  if (phaseLower.startsWith('nurture')) {
    return 'objections';
  }
  
  // Direct mapping for named phases
  const directMap: Record<string, 'discovery' | 'demo' | 'objections'> = {
    'discovery': 'discovery',
    'demo': 'demo',
    'objections': 'objections',
    'closing': 'objections' // Closing uses objections script
  };
  
  const mappedType = directMap[phase];
  if (!mappedType) {
    // UNKNOWN PHASE: Preserve existing script type if valid, otherwise default to 'discovery'
    if (existingScriptType && ['discovery', 'demo', 'objections'].includes(existingScriptType)) {
      console.warn(`⚠️ [mapPhaseToScriptType] Unknown phase "${phase}" - preserving existing type '${existingScriptType}'`);
      return existingScriptType as 'discovery' | 'demo' | 'objections';
    }
    console.warn(`⚠️ [mapPhaseToScriptType] Unknown phase "${phase}" - defaulting to 'discovery'`);
    return 'discovery';
  }
  
  return mappedType;
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📚 CONVERSATION HISTORY LOADER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Carica la cronologia dei messaggi dal database per garantire continuità
 * della conversazione anche dopo reconnect del WebSocket.
 * 
 * Questa funzione viene chiamata SEMPRE prima di costruire il prompt,
 * sia al setup iniziale che ad ogni reconnect dopo i 7 minuti.
 */
interface ConversationHistoryResult {
  history: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}>;
  savedTimestamps: Set<string>;
  aiConversationId: string | null;
}

async function loadConversationHistory(
  connectionId: string,
  mode: 'sales_agent' | 'consultation_invite' | 'assistenza' | 'consulente',
  conversationId: string | null,
  isReconnect: boolean = false,
  aiConversationIdOverride: string | null = null // Allow passing aiConversationId directly
): Promise<ConversationHistoryResult> {
  
  const loadStartTime = Date.now();
  const contextLabel = isReconnect ? '🔄 RECONNECT' : '🆕 FIRST SETUP';
  
  console.log(`\n╔${'═'.repeat(78)}╗`);
  console.log(`║ 📚 [${connectionId}] CONVERSATION HISTORY LOADER - ${contextLabel.padEnd(46)} ║`);
  console.log(`╠${'═'.repeat(78)}╣`);
  console.log(`║ Mode: ${mode.padEnd(70)} ║`);
  console.log(`║ ConversationId: ${(conversationId || 'NULL').padEnd(57)} ║`);
  console.log(`║ IsReconnect: ${String(isReconnect).padEnd(63)} ║`);
  console.log(`╚${'═'.repeat(78)}╝\n`);
  
  // Initialize result
  const result: ConversationHistoryResult = {
    history: [],
    savedTimestamps: new Set<string>(),
    aiConversationId: null
  };
  
  // Only load for sales_agent and consultation_invite modes
  if (mode !== 'sales_agent' && mode !== 'consultation_invite') {
    console.log(`⏭️  [${connectionId}] [HISTORY LOAD] Skipping - mode '${mode}' doesn't use database history`);
    return result;
  }
  
  if (!conversationId) {
    console.log(`❌ [${connectionId}] [HISTORY LOAD] Missing conversationId - cannot load history`);
    return result;
  }
  
  try {
    // STEP 1: Load conversation from database
    console.log(`\n┌─ STEP 1: Loading conversation metadata...`);
    const conversation = await storage.getClientSalesConversationById(conversationId);
    
    if (!conversation) {
      console.log(`│  ❌ Conversation not found in database`);
      console.log(`└─ STEP 1: FAILED\n`);
      return result;
    }
    
    console.log(`│  ✅ Found conversation: ${conversation.prospectName}`);
    console.log(`│     - Phase: ${conversation.currentPhase}`);
    console.log(`│     - Created: ${conversation.createdAt.toISOString()}`);
    console.log(`│     - aiConversationId: ${conversation.aiConversationId || 'NULL'}`);
    
    // Use override if provided (e.g., when aiConversation was just created)
    const effectiveAiConversationId = aiConversationIdOverride || conversation.aiConversationId;
    result.aiConversationId = effectiveAiConversationId;
    
    if (aiConversationIdOverride) {
      console.log(`│     - Using aiConversationId override: ${aiConversationIdOverride}`);
    }
    
    if (!effectiveAiConversationId) {
      console.log(`│  ⚠️  No aiConversationId linked - history not available yet`);
      console.log(`└─ STEP 1: COMPLETED (no history to load)\n`);
      return result;
    }
    
    console.log(`└─ STEP 1: COMPLETED\n`);
    
    // STEP 2: Load messages from aiConversation
    console.log(`┌─ STEP 2: Loading message history from aiConversation...`);
    console.log(`│  Query: SELECT * FROM ai_messages WHERE conversationId = '${effectiveAiConversationId}'`);
    
    const queryStartTime = Date.now();
    const existingMessages = await db.select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, effectiveAiConversationId))
      .orderBy(aiMessages.createdAt);
    
    const queryDuration = Date.now() - queryStartTime;
    
    console.log(`│  ⏱️  Query executed in ${queryDuration}ms`);
    console.log(`│  📊 Found ${existingMessages.length} messages`);
    
    if (existingMessages.length === 0) {
      console.log(`│  ℹ️  No previous messages found - this is a new conversation`);
      console.log(`└─ STEP 2: COMPLETED (empty history)\n`);
      return result;
    }
    
    // STEP 3: Transform and validate messages
    console.log(`│`);
    console.log(`├─ STEP 3: Transforming messages...`);
    
    result.history = existingMessages.map((msg, index) => {
      const transformed = {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.createdAt
      };
      
      // Mark timestamp as already saved
      result.savedTimestamps.add(msg.createdAt.toISOString());
      
      // Log first 3 and last 3 messages for debugging
      if (index < 3 || index >= existingMessages.length - 3) {
        const preview = msg.content.substring(0, 60).replace(/\n/g, ' ');
        console.log(`│  ${index === 0 ? '┌' : index === existingMessages.length - 1 ? '└' : '├'}─ [${index + 1}/${existingMessages.length}] ${msg.role.toUpperCase()}: "${preview}${msg.content.length > 60 ? '...' : ''}"`);
        console.log(`│  ${index === existingMessages.length - 1 ? ' ' : '│'}  Time: ${msg.createdAt.toLocaleTimeString('it-IT')}`);
      } else if (index === 3) {
        console.log(`│  ├─ ... (${existingMessages.length - 6} more messages) ...`);
      }
      
      return transformed;
    });
    
    console.log(`└─ STEP 3: COMPLETED\n`);
    
    // FINAL SUMMARY
    const loadDuration = Date.now() - loadStartTime;
    const firstMessage = result.history[0];
    const lastMessage = result.history[result.history.length - 1];
    
    console.log(`\n╔${'═'.repeat(78)}╗`);
    console.log(`║ ✅ [${connectionId}] HISTORY LOAD ${isReconnect ? 'AFTER RECONNECT' : 'AT FIRST SETUP'} - SUCCESS ${' '.repeat(20)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ 📊 SUMMARY:                                                              ║`);
    console.log(`║    • Total messages loaded: ${String(result.history.length).padEnd(48)} ║`);
    console.log(`║    • aiConversationId: ${(result.aiConversationId || 'NULL').padEnd(52)} ║`);
    console.log(`║    • First message: ${firstMessage.timestamp.toLocaleString('it-IT').padEnd(54)} ║`);
    console.log(`║    • Last message: ${lastMessage.timestamp.toLocaleString('it-IT').padEnd(55)} ║`);
    console.log(`║    • Load duration: ${loadDuration}ms${' '.repeat(55 - String(loadDuration).length)} ║`);
    console.log(`║    • Marked ${result.savedTimestamps.size} timestamps as already saved${' '.repeat(33 - String(result.savedTimestamps.size).length)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ 🎯 NEXT: Passing history to buildSalesAgentPrompt for context continuity ║`);
    console.log(`╚${'═'.repeat(78)}╝\n`);
    
  } catch (error: any) {
    console.log(`\n╔${'═'.repeat(78)}╗`);
    console.log(`║ ❌ [${connectionId}] HISTORY LOAD FAILED                                     ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ Error: ${error.message.substring(0, 68).padEnd(68)} ║`);
    console.log(`║ Stack: ${(error.stack?.split('\n')[1] || '').trim().substring(0, 68).padEnd(68)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ ⚠️  Continuing with EMPTY history - conversation will restart from zero  ║`);
    console.log(`╚${'═'.repeat(78)}╝\n`);
  }
  
  return result;
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🤖➡️😊 CONTEXTUAL RESPONSE DETECTION (Anti-Robot Mode)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Detects when prospect asks questions during sales conversation
 * and tracks if AI responds appropriately (Anti-Robot Mode)
 */

/**
 * Check if user message is a question requiring immediate response
 */
function isProspectQuestion(message: string): boolean {
  const messageLower = message.toLowerCase().trim();
  
  // Pattern 1: Ends with "?"
  if (messageLower.endsWith('?')) {
    return true;
  }
  
  // Pattern 2: Question words
  const questionPatterns = [
    /^perch[eé]/,           // "Perché..."
    /^come mai/,            // "Come mai..."
    /^cosa intendi/,        // "Cosa intendi..."
    /^in che senso/,        // "In che senso..."
    /^non capisco/,         // "Non capisco..."
    /^scusa,? ma/,          // "Scusa ma..."
    /^aspetta,?/,           // "Aspetta..."
    /mi stai chiedendo/,    // "Mi stai chiedendo..."
    /perch[eé] mi chiedi/,  // "Perché mi chiedi..."
  ];
  
  return questionPatterns.some(pattern => pattern.test(messageLower));
}

/**
 * Setup Gemini Live API WebSocket Service
 * 
 * Endpoint: /ws/ai-voice
 * 
 * Funzionalità:
 * - Conversazione vocale bidirezionale real-time
 * - Voce: achernar (italiano, professionale)
 * - Trascrizione automatica input/output
 * - Barge-in (interruzione naturale)
 */

interface LiveMessage {
  type: 'audio' | 'end_session' | 'ping' | 'conversation_update';
  data?: string; // Base64 PCM16 (16kHz)
  sequence?: number;
  conversationData?: {
    messages: Array<{
      role: 'user' | 'assistant';
      transcript: string;
      audioBuffer?: string; // Base64
      duration: number;
      timestamp: string;
    }>;
    duration: number;
    mode: string;
  };
}

/**
 * Valida JWT token ed estrai userId, consultantId, mode e consultantType
 * Token e parametri passati in query string: ?token=JWT_TOKEN&mode=assistenza&consultantType=finanziario
 * 
 * Per Sales Agent mode: ?mode=sales_agent&sessionToken=JWT_SESSION_TOKEN&shareToken=SHARE_TOKEN
 */
async function getUserIdFromRequest(req: any): Promise<{ 
  userId: string | null; // null for sales_agent/consultation_invite modes
  role: string; 
  consultantId: string | null;
  mode: 'assistenza' | 'consulente' | 'sales_agent' | 'consultation_invite';
  consultantType: 'finanziario' | 'vendita' | 'business' | null;
  customPrompt: string | null;
  useFullPrompt: boolean;
  voiceName: string;
  resumeHandle: string | null;
  sessionType: 'weekly_consultation' | null;
  // Sales Agent specific fields
  conversationId: string | null;
  agentId: string | null;
  shareToken: string | null;
  // Consultation Invite specific fields
  inviteToken: string | null;
} | null> {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const sessionToken = url.searchParams.get('sessionToken');
    const shareToken = url.searchParams.get('shareToken');
    const inviteToken = url.searchParams.get('inviteToken');
    const mode = url.searchParams.get('mode');
    const consultantType = url.searchParams.get('consultantType');
    const customPrompt = url.searchParams.get('customPrompt');
    const useFullPrompt = url.searchParams.get('useFullPrompt') === 'true';
    const voiceName = url.searchParams.get('voice') || 'achernar';
    const resumeHandle = url.searchParams.get('resumeHandle');
    const sessionType = url.searchParams.get('sessionType');

    if (!mode) {
      console.error('❌ No mode provided in WebSocket connection');
      return null;
    }

    // Validate mode
    if (mode !== 'assistenza' && mode !== 'consulente' && mode !== 'sales_agent' && mode !== 'consultation_invite') {
      console.error('❌ Invalid mode provided. Must be "assistenza", "consulente", "sales_agent", or "consultation_invite"');
      return null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SALES AGENT MODE - Public prospect sessions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mode === 'sales_agent') {
      if (!sessionToken) {
        console.error('❌ No sessionToken provided for sales_agent mode');
        return null;
      }

      if (!shareToken) {
        console.error('❌ No shareToken provided for sales_agent mode');
        return null;
      }

      // Verify session JWT
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;

      // Validate JWT type
      if (decoded.type !== 'sales_agent_session') {
        console.error('❌ Invalid sessionToken type. Must be sales_agent_session');
        return null;
      }

      // Validate JWT has required fields
      if (!decoded.conversationId || !decoded.agentId || !decoded.shareToken) {
        console.error('❌ Invalid sessionToken: missing required fields');
        return null;
      }

      // Validate shareToken matches JWT
      if (decoded.shareToken !== shareToken) {
        console.error('❌ shareToken mismatch with sessionToken');
        return null;
      }

      // Load agent by shareToken to validate it's still active
      const agent = await storage.getClientSalesAgentByShareToken(shareToken);
      if (!agent) {
        console.error('❌ Sales agent not found for shareToken');
        return null;
      }

      if (!agent.isActive) {
        console.error('❌ Sales agent is not active');
        return null;
      }

      // Validate agentId matches
      if (agent.id !== decoded.agentId) {
        console.error('❌ agentId mismatch');
        return null;
      }

      // Load conversation to verify it exists
      const conversation = await storage.getClientSalesConversationById(decoded.conversationId);
      if (!conversation) {
        console.error('❌ Conversation not found');
        return null;
      }

      console.log(`✅ WebSocket authenticated: Sales Agent Session - Conversation ${conversation.id} - Prospect: ${conversation.prospectName}`);

      return {
        userId: null, // No user for sales agent mode
        role: 'prospect', // Virtual role
        consultantId: agent.consultantId,
        mode: 'sales_agent',
        consultantType: null,
        customPrompt: null,
        useFullPrompt: false,
        voiceName: voiceName,
        resumeHandle: resumeHandle,
        sessionType: null,
        // Sales Agent specific
        conversationId: conversation.id,
        agentId: agent.id,
        shareToken: shareToken,
        inviteToken: null,
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONSULTATION INVITE MODE - Public prospect sessions via invite links
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mode === 'consultation_invite') {
      if (!sessionToken) {
        console.error('❌ No sessionToken provided for consultation_invite mode');
        return null;
      }

      if (!inviteToken) {
        console.error('❌ No inviteToken provided for consultation_invite mode');
        return null;
      }

      // Verify session JWT
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;

      // Validate JWT type
      if (decoded.type !== 'consultation_invite_session') {
        console.error('❌ Invalid sessionToken type. Must be consultation_invite_session');
        return null;
      }

      // Validate JWT has required fields
      if (!decoded.conversationId || !decoded.agentId || !decoded.inviteToken) {
        console.error('❌ Invalid sessionToken: missing required fields');
        return null;
      }

      // Validate inviteToken matches JWT
      if (decoded.inviteToken !== inviteToken) {
        console.error('❌ inviteToken mismatch with sessionToken');
        return null;
      }

      // Load invite to validate it's still active
      const invite = await storage.getConsultationInviteByToken(inviteToken);
      if (!invite) {
        console.error('❌ Consultation invite not found');
        return null;
      }

      if (invite.status !== 'pending' && invite.status !== 'active') {
        console.error(`❌ Consultation invite is not active (status: ${invite.status})`);
        return null;
      }

      // Load agent to validate it's still active
      const agent = await storage.getClientSalesAgentById(invite.agentId);
      if (!agent) {
        console.error('❌ Sales agent not found for invite');
        return null;
      }

      if (!agent.isActive) {
        console.error('❌ Sales agent is not active');
        return null;
      }

      // Validate agentId matches
      if (agent.id !== decoded.agentId) {
        console.error('❌ agentId mismatch');
        return null;
      }

      // Load conversation to verify it exists
      const conversation = await storage.getClientSalesConversationById(decoded.conversationId);
      if (!conversation) {
        console.error('❌ Conversation not found');
        return null;
      }

      console.log(`✅ WebSocket authenticated: Consultation Invite - Conversation ${conversation.id} - Prospect: ${conversation.prospectName} - Invite: ${inviteToken}`);

      return {
        userId: null, // No user for consultation invite mode
        role: 'prospect', // Virtual role
        consultantId: agent.consultantId,
        mode: 'consultation_invite',
        consultantType: null,
        customPrompt: null,
        useFullPrompt: false,
        voiceName: voiceName,
        resumeHandle: resumeHandle,
        sessionType: null,
        // Consultation Invite specific
        conversationId: conversation.id,
        agentId: agent.id,
        shareToken: null,
        inviteToken: inviteToken,
      };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CLIENT MODE - Authenticated user sessions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (!token) {
      console.error('❌ No JWT token provided in WebSocket connection');
      return null;
    }

    // Validate consultantType (optional, validated separately if needed)

    // Verifica JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Carica utente dal database per validare
    const user = await storage.getUser(decoded.userId);

    if (!user) {
      console.error('❌ Invalid JWT: user not found');
      return null;
    }

    // Verifica che sia un client (solo i client possono usare Live Mode)
    if (user.role !== 'client') {
      console.error('❌ Live Mode is only available for clients');
      return null;
    }

    console.log(`✅ WebSocket authenticated: ${user.email} (${user.id}) - Mode: ${mode}${consultantType ? ` (${consultantType})` : ''}${customPrompt ? ' - Custom Prompt: Yes' : ''}${sessionType === 'weekly_consultation' ? ' - Consulenza Settimanale' : ''}${resumeHandle ? ' - Resuming Session' : ''}`);

    // Validazione access control per consulenze settimanali
    if (sessionType === 'weekly_consultation') {
      console.log(`🔒 [CONSULTATION ACCESS] Validating weekly consultation access for user ${user.id}...`);
      
      // Trova consulenze attive per questo utente
      const now = new Date();
      const activeConsultations = await db.select()
        .from(aiWeeklyConsultations)
        .where(
          and(
            eq(aiWeeklyConsultations.clientId, user.id),
            eq(aiWeeklyConsultations.consultantId, user.consultantId!),
            gte(aiWeeklyConsultations.scheduledFor, new Date(now.getTime() - 90 * 60 * 1000)) // Ultimi 90 minuti
          )
        )
        .limit(1);
      
      if (activeConsultations.length === 0) {
        console.error('❌ No active consultation found for WebSocket connection');
        return null;
      }
      
      const consultation = activeConsultations[0];
      
      // Se modalità test, permetti sempre
      if (consultation.isTestMode) {
        console.log(`✅ [CONSULTATION ACCESS] Test mode - access granted`);
      } else {
        // Altrimenti controlla orario
        const scheduledDate = new Date(consultation.scheduledFor);
        const timeDiff = scheduledDate.getTime() - now.getTime();
        
        // Permetti accesso se entro 5 minuti prima o durante le 90 min della sessione
        const canAccess = timeDiff <= 5 * 60 * 1000 && timeDiff >= -90 * 60 * 1000;
        
        if (!canAccess) {
          console.error('❌ Consultation access denied - outside allowed time window');
          return null;
        }
        
        console.log(`✅ [CONSULTATION ACCESS] Access granted for scheduled consultation ${consultation.id}`);
      }
    }

    return {
      userId: user.id,
      role: user.role,
      consultantId: user.consultantId,
      mode: mode as 'assistenza' | 'consulente',
      consultantType: consultantType as 'finanziario' | 'vendita' | 'business' | null,
      customPrompt: customPrompt,
      useFullPrompt: useFullPrompt,
      voiceName: voiceName,
      resumeHandle: resumeHandle,
      sessionType: sessionType as 'weekly_consultation' | null,
      // Sales Agent/Consultation Invite fields (null for client mode)
      conversationId: null,
      agentId: null,
      shareToken: null,
      inviteToken: null,
    };
  } catch (error) {
    console.error('❌ JWT validation error:', error);
    return null;
  }
}

/**
 * Setup WebSocket server per Gemini Live API
 */
export function setupGeminiLiveWSService(server: Server) {
  console.log('🔧 Setting up Gemini Live WebSocket server...');
  
  const wss = new WebSocketServer({ 
    server,
    path: '/ws/ai-voice'
  });

  console.log('🔧 WebSocketServer instance created, attaching connection handler...');

  // Debug: log all WebSocketServer events
  wss.on('error', (error) => {
    console.error('❌ WebSocketServer error:', error);
  });

  wss.on('connection', async (clientWs, req) => {
    const connectionId = Math.random().toString(36).substring(7);
    console.log(`🎤 [${connectionId}] Client connected to Live API`);
    
    // 1. Autenticazione JWT ed estrazione parametri
    const authResult = await getUserIdFromRequest(req);
    if (!authResult) {
      console.error(`❌ [${connectionId}] Authentication failed`);
      clientWs.close(4401, 'Unauthorized - Valid JWT token required');
      return;
    }

    const { userId, consultantId, mode, consultantType, customPrompt, useFullPrompt, voiceName, resumeHandle, sessionType, conversationId, agentId, shareToken, inviteToken } = authResult;

    // Validazione: consultantId è obbligatorio per Live Mode (except sales_agent and consultation_invite)
    if (!consultantId && mode !== 'sales_agent' && mode !== 'consultation_invite') {
      console.error(`❌ [${connectionId}] Client ${userId} has no consultant assigned`);
      clientWs.close(4403, 'Live Mode requires consultant assignment');
      return;
    }

    // Validazione critica: consultantType è OBBLIGATORIO per mode consulente
    if (mode === 'consulente' && !consultantType) {
      console.error(`❌ [${connectionId}] consultantType is required for consulente mode`);
      clientWs.close(4403, 'consultantType required for consulente mode');
      return;
    }

    // Validazione: consultantType deve essere un valore valido se fornito
    if (consultantType && consultantType !== 'finanziario' && consultantType !== 'vendita' && consultantType !== 'business') {
      console.error(`❌ [${connectionId}] Invalid consultantType: ${consultantType}`);
      clientWs.close(4400, 'Invalid consultantType. Must be finanziario, vendita, or business');
      return;
    }

    if (mode === 'sales_agent' || mode === 'consultation_invite') {
      const modeLabel = mode === 'sales_agent' ? 'Sales Agent' : 'Consultation Invite';
      console.log(`✅ [${connectionId}] ${modeLabel} Session → Conversation ${conversationId}`);
    } else {
      console.log(`✅ [${connectionId}] Client ${userId} → Consultant ${consultantId}`);
    }

    let geminiSession: any = null;
    let isSessionActive = false;
    
    // Cleanup old session handles from database (older than 90 minutes)
    // Run this async without blocking - it's just housekeeping
    storage.cleanupOldGeminiSessionHandles(90)
      .then(deletedCount => {
        if (deletedCount > 0) {
          console.log(`🗑️  [${connectionId}] Cleaned up ${deletedCount} old session handles from database`);
        }
      })
      .catch(err => console.error(`⚠️  [${connectionId}] Failed to cleanup old handles:`, err.message));
    
    // Session resumption tracking - CRITICAL: Validate ownership before using handle
    // This ensures sessions are isolated per user/agent
    let validatedResumeHandle: string | null = null;
    
    if (resumeHandle) {
      console.log(`🔄 [${connectionId}] Validating resume handle ownership...`);
      console.log(`   → Handle preview: ${resumeHandle.substring(0, 20)}...`);
      console.log(`   → Mode: ${mode}`);
      const isPublicMode = mode === 'sales_agent' || mode === 'consultation_invite';
      console.log(`   → ${isPublicMode ? `${mode === 'sales_agent' ? `ShareToken: ${shareToken}` : `InviteToken: ${inviteToken}`}, ConversationId: ${conversationId}` : `UserId: ${userId}${mode === 'consulente' ? `, ConsultantType: ${consultantType}` : ''}`}`);
      
      try {
        const isValid = await storage.validateGeminiSessionHandle(
          resumeHandle,
          mode,
          isPublicMode ? undefined : userId,
          mode === 'sales_agent' ? shareToken || undefined : undefined,
          isPublicMode ? conversationId || undefined : undefined,
          mode === 'consulente' ? consultantType : undefined,
          mode === 'consultation_invite' ? inviteToken || undefined : undefined
        );
        
        if (!isValid) {
          console.warn(`🚨 [${connectionId}] Resume handle validation FAILED - discarding handle`);
          console.warn(`   → Handle does NOT belong to this ${isPublicMode ? `${mode} session` : 'user'}`);
          console.warn(`   → Will create NEW session instead of resuming`);
          validatedResumeHandle = null;
        } else {
          console.log(`✅ [${connectionId}] Resume handle validated successfully`);
          console.log(`   → Handle belongs to current ${isPublicMode ? `${mode} session` : 'user'}`);
          console.log(`   → Will RESUME existing session`);
          validatedResumeHandle = resumeHandle;
        }
      } catch (dbError: any) {
        console.error(`⚠️  [${connectionId}] Database error during handle validation - creating new session`, dbError.message);
        // FALLBACK: If DB is down, create new session (safer than allowing potential cross-user resume)
        validatedResumeHandle = null;
      }
    }
    
    // Initialize lastSessionHandle with validated handle
    // This ensures GO_AWAY always has a handle to share even before first update
    let lastSessionHandle: string | null = validatedResumeHandle;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 💰 VERTEX AI LIVE API - Official Pricing (Nov 2024)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Token tracking per calcolo costi con supporto cache optimization
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0; // NEW: Track cached input tokens (94% cost savings!)
    let totalAudioInputSeconds = 0; // NEW: Track audio input duration
    let totalAudioOutputSeconds = 0; // NEW: Track audio output duration (most expensive!)
    
    // Official Live API pricing
    const PRICE_CACHED_PER_1M = 0.03;  // $0.03 per 1M tokens (cached input - 94% savings!)
    const PRICE_INPUT_PER_1M = 0.50;  // $0.50 per 1M tokens (fresh text input)
    const PRICE_AUDIO_INPUT_PER_1M = 3.00; // $3.00 per 1M tokens (audio input)
    const PRICE_OUTPUT_PER_1M = 12.00; // $12.00 per 1M tokens (audio output - most expensive!)
    
    // 🔍 TASK 5: Track initial chunk tokens for comparison report
    let sessionInitialChunkTokens = 0; // Estimated tokens from initial chunks sent to Gemini
    
    // 🔍 DEBUG: Track all messages sent in current turn for "Fresh Text Input" analysis
    let currentTurnMessages: Array<{type: string; content: string; size: number; timestamp: Date}> = [];

    // Conversazione tracking per auto-save
    let conversationMessages: Array<{
      role: 'user' | 'assistant';
      transcript: string;
      audioBuffer?: string;
      duration: number;
      timestamp: string;
    }> = [];
    let conversationSaved = false;
    let currentAiConversationId: string | null = null; // For sales_agent/consultation_invite modes
    let savedMessageTimestamps = new Set<string>(); // Track already-saved message timestamps to avoid duplicates
    
    // Accumulatori per trascrizioni in tempo reale
    let currentUserTranscript = '';
    let currentAiTranscript = '';
    let currentAiAudioChunks: string[] = [];
    
    // 🎯 User transcript buffering for sales tracking (with isFinal flag)
    let pendingUserTranscript: { text: string; hasFinalChunk: boolean } = {
      text: '',
      hasFinalChunk: false
    };
    
    // 🔧 VAD CONCATENATION BUFFER: Fix for fragmented speech chunks
    // Problem: VAD sends chunks like "Mol" + "to male." instead of "Molto male."
    // Solution: Detect if chunk is continuation (not cumulative) and concatenate
    let vadConcatBuffer: string = '';
    let vadLastChunkTime: number = 0;
    const VAD_CONCAT_TIMEOUT_MS = 1500; // Reset buffer if gap > 1.5 seconds
    
    // 🔧 FEEDBACK BUFFER: Store SalesManager feedback to append to next user message
    // Instead of injecting with role: 'model' (which Gemini ignores), we append the
    // feedback to the next user message so it gets processed naturally.
    let pendingFeedbackForAI: string | null = null;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🕐 RESPONSE WATCHDOG - Rileva quando Gemini non risponde
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let responseWatchdogTimer: NodeJS.Timeout | null = null;
    let userMessagePendingResponse = false;
    let lastUserFinalTranscript = '';
    let lastUserMessageTimestamp = 0;
    let responseWatchdogRetries = 0;
    const RESPONSE_WATCHDOG_TIMEOUT_MS = 2000; // 2 secondi dopo isFinal
    const MAX_WATCHDOG_RETRIES = 2;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔄 LOOP DETECTION - Rileva quando l'AI ripete la stessa domanda
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const lastAiResponses: string[] = [];
    const MAX_TRACKED_RESPONSES = 5;
    let consecutiveLoopCount = 0;
    let isLooping = false;
    const SIMILARITY_THRESHOLD = 0.75; // 75% similarità = loop
    
    /**
     * Calcola la similarità tra due stringhe (0-1)
     * Usa Jaccard similarity sui primi 100 caratteri normalizzati
     */
    function calculateTextSimilarity(str1: string, str2: string): number {
      // Normalizza: lowercase, rimuovi punteggiatura, trim
      const normalize = (s: string) => 
        s.toLowerCase()
         .replace(/[.,!?;:'"()\[\]{}]/g, '')
         .trim()
         .substring(0, 100); // Solo primi 100 char per velocità
      
      const s1 = normalize(str1);
      const s2 = normalize(str2);
      
      if (s1 === s2) return 1; // Identici
      if (!s1 || !s2) return 0;
      
      // Jaccard similarity sulle parole
      const words1 = new Set(s1.split(/\s+/));
      const words2 = new Set(s2.split(/\s+/));
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      return intersection.size / union.size;
    }
    
    /**
     * Avvia il watchdog timer per rilevare mancate risposte da Gemini
     */
    function startResponseWatchdog(transcript: string, session: any) {
      // Cancella timer precedente se esiste
      if (responseWatchdogTimer) {
        clearTimeout(responseWatchdogTimer);
      }
      
      userMessagePendingResponse = true;
      lastUserFinalTranscript = transcript;
      lastUserMessageTimestamp = Date.now();
      
      console.log(`\n🕐 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🕐 [${connectionId}] WATCHDOG STARTED - Aspetto risposta Gemini entro ${RESPONSE_WATCHDOG_TIMEOUT_MS}ms`);
      console.log(`   📝 Messaggio utente: "${transcript.substring(0, 60)}${transcript.length > 60 ? '...' : ''}"`);
      console.log(`🕐 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      responseWatchdogTimer = setTimeout(() => {
        if (userMessagePendingResponse) {
          const elapsedMs = Date.now() - lastUserMessageTimestamp;
          
          console.log(`\n⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`⚠️ [${connectionId}] WATCHDOG TIMEOUT - Gemini non ha risposto in ${elapsedMs}ms!`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          if (responseWatchdogRetries < MAX_WATCHDOG_RETRIES) {
            responseWatchdogRetries++;
            console.log(`🔄 [${connectionId}] RETRY ${responseWatchdogRetries}/${MAX_WATCHDOG_RETRIES} - Reinvio sollecito...`);
            
            // Reinvia sollecito per stimolare risposta
            const retryMessage = {
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{ text: `[SISTEMA: L'utente ha detto "${lastUserFinalTranscript.substring(0, 100)}..." - Per favore rispondi ora.]` }]
                }],
                turnComplete: true
              }
            };
            
            try {
              session.send(JSON.stringify(retryMessage));
              console.log(`   ✅ Sollecito inviato a Gemini`);
            } catch (sendErr: any) {
              console.error(`   ❌ Errore invio sollecito: ${sendErr.message}`);
            }
            
            // Riavvia il timer per il prossimo tentativo
            startResponseWatchdog(lastUserFinalTranscript, session);
          } else {
            console.log(`🔴 [${connectionId}] MAX RETRY RAGGIUNTO (${MAX_WATCHDOG_RETRIES}) - Invio errore AI_TIMEOUT al client`);
            userMessagePendingResponse = false;
            responseWatchdogRetries = 0;
            
            clientWs.send(JSON.stringify({
              type: 'ai_timeout',
              message: 'L\'AI non sta rispondendo. Riprova a parlare.',
              retries: responseWatchdogRetries,
              elapsedMs
            }));
          }
          console.log(`⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
      }, RESPONSE_WATCHDOG_TIMEOUT_MS);
    }
    
    /**
     * Cancella il watchdog (quando Gemini inizia a rispondere)
     */
    function cancelResponseWatchdog() {
      if (responseWatchdogTimer) {
        const responseTime = Date.now() - lastUserMessageTimestamp;
        console.log(`✅ [${connectionId}] WATCHDOG CANCELLED - Gemini ha risposto in ${responseTime}ms`);
        clearTimeout(responseWatchdogTimer);
        responseWatchdogTimer = null;
      }
      userMessagePendingResponse = false;
      responseWatchdogRetries = 0;
    }
    
    /**
     * 🔧 FIX: Helper to add user message to conversationMessages (deduped)
     * This was missing - only AI messages were being added to conversationMessages,
     * causing SalesManagerAgent to receive AI-only history!
     * 
     * Deduplication logic: Only skip if the IMMEDIATELY PREVIOUS message in
     * conversationMessages is the same user transcript. This allows:
     * - User says "sì" → AI responds → User says "sì" again (both captured)
     * - User's cumulative partial "Ciao" → "Ciao come" (only final captured)
     */
    function commitUserMessage(transcript: string) {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      
      // Only check if LAST message in conversationMessages is same user message
      // This prevents cumulative partials but allows repeated phrases across turns
      const lastMsg = conversationMessages[conversationMessages.length - 1];
      if (lastMsg?.role === 'user' && lastMsg.transcript === trimmed) {
        console.log(`⏭️  [${connectionId}] Skipping duplicate user message (same as last): "${trimmed.substring(0, 50)}..."`);
        return;
      }
      
      conversationMessages.push({
        role: 'user',
        transcript: trimmed,
        duration: 0, // User audio duration calculated by client
        timestamp: new Date().toISOString()
      });
      
      console.log(`💾 [${connectionId}] Saved USER message: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? '...' : ''}" (${conversationMessages.length} total)`);
    }
    
    // 🤖➡️😊 Contextual Response Tracking (Anti-Robot Mode)
    let lastProspectQuestion: string | null = null;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🎯 SALES SCRIPT TRACKING (for sales_agent and consultation_invite modes)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let salesTracker: SalesScriptTracker | null = null;
    let salesLogger: SalesScriptLogger | null = null;
    // 🎯 STEP ADVANCEMENT AGENT: Store IDs for AI-driven step advancement
    let trackerClientId: string | null = null;
    let trackerConsultantId: string | null = null;
    // 🔒 MUTEX: Prevent overlapping step advancement agent calls
    let isAdvancementInProgress = false;
    let lastAdvancedToState: { phase: string; step: string | undefined } | null = null;
    
    if ((mode === 'sales_agent' || mode === 'consultation_invite') && conversationId) {
      try {
        // For consultation_invite, fetch agentId from conversation (invites don't have authenticated consultant session)
        let resolvedAgentId = agentId;
        let resolvedClientId: string | null = null;
        let resolvedScriptType: 'discovery' | 'demo' | 'objections' = 'discovery';
        
        // Load conversation using storage layer (not raw drizzle query)
        const conv = await storage.getClientSalesConversationById(conversationId);
        
        // HARD FAILURE: Conversation must exist for tracker initialization
        if (!conv) {
          console.error(`❌ [${connectionId}] HARD FAILURE: conversation not found (ID: ${conversationId}) - cannot initialize tracker`);
          throw new Error(`Conversation not found: ${conversationId}`);
        }
        
        // Resolve agentId from conversation if not provided (consultation_invite mode)
        if (mode === 'consultation_invite' && !agentId) {
          resolvedAgentId = conv.agentId;
          console.log(`🔍 [${connectionId}] Resolved agentId from conversation: ${resolvedAgentId}`);
        }
        
        // Use centralized phase→scriptType mapping
        resolvedScriptType = mapPhaseToScriptType(conv.currentPhase);
        console.log(`🔍 [${connectionId}] Phase "${conv.currentPhase}" → scriptType "${resolvedScriptType}"`);
        
        // Load agent to get clientId (with proper error handling)
        if (resolvedAgentId) {
          const agentData = await storage.getClientSalesAgentById(resolvedAgentId);
          
          // HARD FAILURE: Agent must exist for tracker initialization
          if (!agentData) {
            console.error(`❌ [${connectionId}] HARD FAILURE: agent not found (ID: ${resolvedAgentId}) - cannot initialize tracker`);
            throw new Error(`Agent not found: ${resolvedAgentId}`);
          }
          
          if (agentData.clientId) {
            resolvedClientId = agentData.clientId;
            console.log(`🔍 [${connectionId}] Resolved clientId from agent: ${resolvedClientId}`);
          } else {
            console.warn(`⚠️ [${connectionId}] Agent ${resolvedAgentId} has no clientId - script tracking may be limited`);
          }
          
          // 🎯 SALES MANAGER AGENT: Save IDs for later use
          // Use the consultantId from the authenticated session (has Vertex AI credentials)
          // This is agent.consultantId which was extracted in getUserIdFromRequest
          if (agentData.consultantId) {
            trackerClientId = agentData.consultantId;
            trackerConsultantId = agentData.consultantId;
            console.log(`🔍 [${connectionId}] Sales Manager Agent will use consultantId: ${trackerConsultantId}`);
          } else {
            console.warn(`⚠️ [${connectionId}] Agent ${resolvedAgentId} has no consultantId - Sales Manager Agent will be disabled`);
          }
        }
        
        if (resolvedAgentId) {
          // Create logger first
          salesLogger = createSalesLogger(connectionId);
          
          // 🔄 Use getOrCreateTracker WITH clientId and scriptType for proper DB script loading
          salesTracker = await getOrCreateTracker(
            conversationId, 
            resolvedAgentId, 
            'phase_1',
            resolvedClientId || undefined,
            resolvedScriptType
          );
          
          // Wire logger to tracker
          (salesTracker as any).logger = salesLogger;
          
          console.log(`✅ [${connectionId}] Sales script tracking enabled (mode: ${mode})`);
          console.log(`   → Tracker initialized for conversation ${conversationId}`);
          console.log(`   → Agent ID: ${resolvedAgentId}`);
          console.log(`   → Client ID: ${resolvedClientId || 'N/A'}`);
          console.log(`   → Script Type: ${resolvedScriptType}`);
          console.log(`   → Logger wired to tracker for real-time structured logging`);
        }
      } catch (error: any) {
        console.error(`❌ [${connectionId}] Failed to initialize sales tracking:`, error.message);
        // Continue without tracking - non-blocking error
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ⏱️  TIMER MANAGEMENT per Weekly Consultations
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let timeUpdateInterval: NodeJS.Timeout | null = null;
    let sessionStartTime: number | null = null; // Authoritative session start (backend is source of truth)
    const CONSULTATION_DURATION_MINUTES = 90; // Durata massima consulenza
    
    // 💾 AUTOSAVE INTERVAL per Sales Agent / Consultation Invite
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let autosaveInterval: NodeJS.Timeout | null = null;
    const AUTOSAVE_INTERVAL_MS = 30 * 1000; // 30 secondi
    const TIME_UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minuti
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔒 INTELLIGENT AUTO-CLOSE MECHANISM (90 min)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    type ClosingState = 'idle' | 'waiting_ai_finish' | 'waiting_saluto' | 'ready_to_close';
    let closingState: ClosingState = 'idle';
    let isAiSpeaking = false; // Track se AI sta parlando (streaming audio)
    let closeCheckInterval: NodeJS.Timeout | null = null; // Check ogni secondo dopo 90 min
    let hardTimeoutTimer: NodeJS.Timeout | null = null; // Failsafe: force close dopo 30s
    let hasTriggered90MinClose = false; // Flag per evitare multiple trigger
    
    // 🆕 TASK 7: prospectHasSpoken - blocca output AI finché utente non parla
    // Questo previene che l'AI parli per primo sia all'inizio della call che dopo resume
    let prospectHasSpoken = false; 
    let aiOutputBuffered = 0; // Contatore chunk audio bufferizzati quando prospect non ha ancora parlato
    
    // Pattern matching per saluti italiani (case-insensitive)
    const GREETING_PATTERNS = [
      /\barrivederci\b/i,
      /\balla prossima\b/i,
      /\bbuona giornata\b/i,
      /\bci vediamo\b/i,
      /\ba presto\b/i,
      /\bbuonanotte\b/i,
      /\bciao\b/i,
      /\ba dopo\b/i,
      /\bci sentiamo\b/i
    ];
    
    // Se è una consulenza settimanale, recupera metadata per offset
    let timeOffsetMinutes = 0; // Offset per sessioni riprese
    let currentConsultationId: string | null = null; // Track consultation ID per cache updates
    
    if (sessionType === 'weekly_consultation') {
      const now = new Date();
      const consultations = await db.select()
        .from(aiWeeklyConsultations)
        .where(
          and(
            eq(aiWeeklyConsultations.clientId, userId),
            eq(aiWeeklyConsultations.consultantId, consultantId),
            gte(aiWeeklyConsultations.scheduledFor, new Date(now.getTime() - 90 * 60 * 1000))
          )
        )
        .limit(1);
      
      if (consultations.length > 0) {
        const consultation = consultations[0];
        currentConsultationId = consultation.id; // Salva consultationId per cache updates
        const scheduledDate = new Date(consultation.scheduledFor);
        
        // 🟢 CACHE UPDATE: Marca sessione come attiva
        refreshSessionActivity(currentConsultationId, userId);
        console.log(`🟢 [CACHE] Session started: ${currentConsultationId}`);
        
        // Calcola offset: tempo trascorso da quando era programmata
        // Questo serve per sessioni riprese: se la consulenza era programmata 20 min fa
        // e l'utente riconnette, l'offset è 20 minuti
        timeOffsetMinutes = Math.floor((now.getTime() - scheduledDate.getTime()) / (1000 * 60));
        
        // Assicuriamoci che l'offset sia >= 0 e <= 90
        timeOffsetMinutes = Math.max(0, Math.min(timeOffsetMinutes, CONSULTATION_DURATION_MINUTES));
        
        if (validatedResumeHandle && timeOffsetMinutes > 0) {
          console.log(`⏱️  [${connectionId}] RESUME with offset: ${timeOffsetMinutes} minutes elapsed since scheduled time`);
        } else if (timeOffsetMinutes > 0) {
          console.log(`⏱️  [${connectionId}] Late start: ${timeOffsetMinutes} minutes after scheduled time`);
        } else {
          console.log(`⏱️  [${connectionId}] Starting on time (scheduledFor: ${scheduledDate.toISOString()})`);
        }
        
        // ⏱️  FIX CRITICO: Inizializza sessionStartTime PRIMA che Gemini socket si apra
        // Backend è l'authority per il timing - deve essere inizializzato subito
        // per garantire che il timer funzioni anche per consulenze iniziali (senza resumeHandle)
        
        // 🔑 CRITICAL FIX: Se la consulenza ha già un startedAt (resume dopo disconnect temp),
        // usa quello invece di creare un nuovo timestamp - questo previene il reset del timer
        if (consultation.startedAt) {
          sessionStartTime = new Date(consultation.startedAt).getTime();
          console.log(`⏱️  [${connectionId}] ✅ Session start time from database (RESUMED SESSION):`);
          console.log(`   → startedAt: ${new Date(sessionStartTime).toISOString()}`);
          console.log(`   → Current time: ${now.toISOString()}`);
          const actualElapsed = Math.floor((now.getTime() - sessionStartTime) / 60000);
          console.log(`   → Actual elapsed time: ${actualElapsed} minutes`);
          console.log(`   → Timer will continue from where it was before disconnect`);
        } else {
          // Prima volta che si avvia la consulenza - calcola il sessionStartTime e salvalo nel DB
          sessionStartTime = now.getTime() - (timeOffsetMinutes * 60 * 1000);
          console.log(`⏱️  [${connectionId}] ✅ Session start time calculated (NEW SESSION):`);
          console.log(`   → Calculated start: ${new Date(sessionStartTime).toISOString()}`);
          console.log(`   → Current time: ${now.toISOString()}`);
          console.log(`   → Offset applied: ${timeOffsetMinutes} minutes`);
          console.log(`   → This ensures timer works immediately for new consultations`);
          
          // 💾 Salva startedAt nel database per future riconnessioni
          try {
            await db.update(aiWeeklyConsultations)
              .set({ 
                startedAt: new Date(sessionStartTime),
                status: 'in_progress'
              })
              .where(eq(aiWeeklyConsultations.id, consultation.id));
            console.log(`💾 [${connectionId}] Saved startedAt to database: ${new Date(sessionStartTime).toISOString()}`);
          } catch (err) {
            console.error(`❌ [${connectionId}] Failed to save startedAt:`, err);
          }
        }
      }
    }

    try {
      // 2. Get OAuth2 token for Vertex AI Live API
      console.log(`🔑 [${connectionId}] Getting OAuth2 token for Vertex AI Live API...`);
      const vertexConfig = await getVertexAITokenForLive(
        (mode === 'sales_agent' || mode === 'consultation_invite') ? null : userId, 
        consultantId
      );
      
      if (!vertexConfig) {
        throw new Error('Failed to get Vertex AI token for Live API - no valid configuration found');
      }

      // 2b. Build prompts based on mode
      let systemInstruction: string;
      let userDataContext: string | null = null;
      let userContext: any = null; // Declare here to be accessible throughout the function
      let conversationHistory: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}> = []; // For sales_agent/consultation_invite modes
      let agentBusinessContext: { businessName: string; whatWeDo: string; servicesOffered: string[]; targetClient: string; nonTargetClient: string } | undefined = undefined; // 🆕 Business context per feedback
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SALES AGENT / CONSULTATION INVITE MODE - Build prompt from agent config
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (mode === 'sales_agent' || mode === 'consultation_invite') {
        const modeLabel = mode === 'sales_agent' ? 'Sales Agent' : 'Consultation Invite';
        console.log(`📊 [${connectionId}] Building ${modeLabel} prompt...`);
        
        // Load agent config (different methods for different modes)
        let agent;
        if (mode === 'sales_agent') {
          agent = await storage.getClientSalesAgentByShareToken(shareToken!);
        } else {
          // consultation_invite mode: load agent from invite
          const invite = await storage.getConsultationInviteByToken(inviteToken!);
          if (invite) {
            agent = await storage.getClientSalesAgentById(invite.agentId);
          }
        }
        
        if (!agent) {
          throw new Error('Sales agent not found');
        }
        
        // 🆕 Salva business context per uso nel WebSocket handler (Sales Manager feedback)
        agentBusinessContext = {
          businessName: agent.businessName || '',
          whatWeDo: agent.whatWeDo || agent.businessDescription || '',
          servicesOffered: agent.servicesOffered?.map((s: any) => s.name || s) || [],
          targetClient: agent.targetClient || agent.whoWeHelp || '',
          nonTargetClient: agent.nonTargetClient || agent.whoWeDontHelp || ''
        };
        console.log(`👤 [${connectionId}] Business context saved: ${agentBusinessContext.businessName}`);
        
        // Load conversation data
        const conversation = await storage.getClientSalesConversationById(conversationId!);
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SAVE USED SCRIPT INFO - THREE-TIERED PERSISTENCE (HYBRID Option C)
        // TIER 1: Try tracker.getUsedScriptInfo() first → scriptSource="database"
        // TIER 2: Query salesScripts table directly → scriptSource="database"
        // TIER 3: No script found → scriptSource="hardcoded_default", usedScriptId/Name=null
        // GUARANTEE: usedScriptSource always indicates where script came from
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        try {
          // TIER 1: Try tracker.getUsedScriptInfo() first (priority source)
          const trackerScriptInfo = salesTracker?.getUsedScriptInfo?.();
          
          if (trackerScriptInfo && trackerScriptInfo.id) {
            // Tracker has valid script info from database - use it
            await storage.updateClientSalesConversation(conversationId!, {
              usedScriptId: trackerScriptInfo.id,
              usedScriptName: trackerScriptInfo.name,
              usedScriptType: trackerScriptInfo.scriptType,
              usedScriptSource: 'database'
            });
            console.log(`📚 [${connectionId}] [TIER 1] Saved script from tracker: "${trackerScriptInfo.name}" (${trackerScriptInfo.id}) [source=database]`);
          } else if (agent.clientId) {
            // TIER 2 FALLBACK: Query salesScripts table directly
            console.log(`🔍 [${connectionId}] [TIER 2] Tracker has no script info - querying salesScripts table directly...`);
            
            // Determine script type from phase, preserving existing type if phase is unknown
            const scriptType = mapPhaseToScriptType(conversation.currentPhase, conversation.usedScriptType);
            console.log(`   Phase: "${conversation.currentPhase}" → ScriptType: "${scriptType}"`);
            
            // Query for active script matching this type for this client
            const activeScriptResults = await db.select()
              .from(salesScripts)
              .where(and(
                eq(salesScripts.clientId, agent.clientId),
                eq(salesScripts.scriptType, scriptType),
                eq(salesScripts.isActive, true)
              ))
              .limit(1);
            
            const activeScript = activeScriptResults[0];
            
            if (activeScript) {
              // Found active script in DB - save it with source=database
              await storage.updateClientSalesConversation(conversationId!, {
                usedScriptId: activeScript.id,
                usedScriptName: activeScript.name,
                usedScriptType: activeScript.scriptType,
                usedScriptSource: 'database'
              });
              console.log(`📚 [${connectionId}] [TIER 2] Saved script from DB: "${activeScript.name}" (${activeScript.id}) [source=database]`);
            } else if (!conversation.usedScriptId) {
              // TIER 3: No active script in DB AND no existing data - using hardcoded defaults
              // Set usedScriptId/usedScriptName to null (not placeholder text)
              await storage.updateClientSalesConversation(conversationId!, {
                usedScriptId: null,
                usedScriptName: null,
                usedScriptType: scriptType,
                usedScriptSource: 'hardcoded_default'
              });
              console.log(`🔧 [${connectionId}] [TIER 3] No active ${scriptType} script in DB - using hardcoded defaults [source=hardcoded_default]`);
            } else {
              // No active script in DB but we have existing data - preserve it
              console.log(`✅ [${connectionId}] [TIER 2] No new script found, preserving existing: "${conversation.usedScriptName}" (${conversation.usedScriptId})`);
            }
          } else {
            console.warn(`⚠️ [${connectionId}] Agent has no clientId - cannot query salesScripts for fallback`);
          }
        } catch (err: any) {
          console.warn(`⚠️ [${connectionId}] Failed to save used script info: ${err.message}`);
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ENSURE AI CONVERSATION EXISTS (for message history persistence)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        currentAiConversationId = conversation.aiConversationId;
        
        if (!currentAiConversationId) {
          console.log(`📝 [${connectionId}] No aiConversation linked - creating new one for message history...`);
          
          // Retry logic for aiConversation creation to ensure zero message loss
          let retryCount = 0;
          const maxRetries = 3;
          let creationSuccess = false;
          
          while (!creationSuccess && retryCount < maxRetries) {
            try {
              // Create new aiConversation for this sales conversation
              // Use salesConversationId instead of clientId (prospect is not a registered user)
              const [newAiConversation] = await db.insert(aiConversations).values({
                clientId: null, // Prospect is not a registered user
                salesConversationId: conversationId, // Link to sales conversation
                title: `${modeLabel}: ${conversation.prospectName}`,
                mode: 'live_voice', // Both sales_agent and consultation_invite use live_voice mode in DB
                lastMessageAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
              }).returning();
              
              currentAiConversationId = newAiConversation.id;
              
              // Update clientSalesConversation with the new aiConversationId
              await storage.updateClientSalesConversation(conversationId!, {
                aiConversationId: currentAiConversationId
              });
              
              console.log(`✅ [${connectionId}] Created aiConversation ${currentAiConversationId} and linked to sales conversation`);
              creationSuccess = true;
            } catch (err: any) {
              retryCount++;
              console.error(`❌ [${connectionId}] Failed to create aiConversation (attempt ${retryCount}/${maxRetries}):`, err.message);
              
              if (retryCount < maxRetries) {
                const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                console.log(`   ⏳ Retrying in ${backoffMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
              } else {
                console.error(`❌ [${connectionId}] CRITICAL: All ${maxRetries} attempts failed to create aiConversation`);
                console.error(`   💥 FAIL-FAST: Cannot guarantee message persistence - closing session`);
                console.error(`   Error details:`, err);
                // currentAiConversationId remains null - will be caught by final check below
              }
            }
          }
        } else {
          console.log(`✅ [${connectionId}] Found existing aiConversation ${currentAiConversationId} - will load message history`);
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CRITICAL FINAL CHECK: Verify aiConversationId exists AND is valid
        // This check happens AFTER both branches (creation + existing) to guarantee
        // that the session NEVER starts without a valid aiConversationId
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (!currentAiConversationId) {
          console.error(`❌ [${connectionId}] CRITICAL: No aiConversationId after all attempts`);
          console.error(`   💥 ABORTING SESSION: Cannot guarantee message persistence`);
          
          clientWs.send(JSON.stringify({
            type: 'setup_error',
            error: 'Failed to initialize conversation persistence. Please try again later.'
          }));
          clientWs.close(1011, 'Database initialization failed');
          return; // HARD STOP - session will NOT start
        }
        
        // VALIDATE: Ensure aiConversation record actually exists in database
        // This prevents edge case where FK exists but record was deleted
        console.log(`🔍 [${connectionId}] Validating aiConversation existence in database...`);
        try {
          const existingAiConversation = await db.select()
            .from(aiConversations)
            .where(eq(aiConversations.id, currentAiConversationId))
            .limit(1);
          
          if (existingAiConversation.length === 0) {
            console.error(`❌ [${connectionId}] CRITICAL: aiConversation ${currentAiConversationId} not found in database`);
            console.error(`   💥 Stale FK detected - record was deleted. Creating new aiConversation...`);
            
            // Recreate aiConversation since record was deleted
            let recreateSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                const [newAiConversation] = await db.insert(aiConversations).values({
                  clientId: null,
                  salesConversationId: conversationId,
                  title: `${modeLabel}: ${conversation.prospectName}`,
                  mode: 'live_voice',
                  lastMessageAt: new Date(),
                  createdAt: new Date(),
                  updatedAt: new Date()
                }).returning();
                
                currentAiConversationId = newAiConversation.id;
                
                await storage.updateClientSalesConversation(conversationId!, {
                  aiConversationId: currentAiConversationId
                });
                
                console.log(`✅ [${connectionId}] Recreated aiConversation ${currentAiConversationId}`);
                recreateSuccess = true;
                break;
              } catch (err: any) {
                console.error(`❌ [${connectionId}] Recreate attempt ${attempt}/3 failed:`, err.message);
                if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }
            
            if (!recreateSuccess) {
              console.error(`❌ [${connectionId}] CRITICAL: Failed to recreate aiConversation`);
              clientWs.send(JSON.stringify({
                type: 'setup_error',
                error: 'Failed to initialize conversation persistence. Please try again later.'
              }));
              clientWs.close(1011, 'Database initialization failed');
              return;
            }
          } else {
            console.log(`✅ [${connectionId}] aiConversation ${currentAiConversationId} validated - record exists`);
          }
        } catch (validationErr: any) {
          console.error(`❌ [${connectionId}] CRITICAL: Failed to validate aiConversation existence:`, validationErr.message);
          clientWs.send(JSON.stringify({
            type: 'setup_error',
            error: 'Failed to validate conversation persistence. Please try again later.'
          }));
          clientWs.close(1011, 'Database validation failed');
          return;
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // LOAD CONVERSATION HISTORY (SEMPRE - serve per prompt e persistence)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const isReconnectAttempt = !!validatedResumeHandle; // Se c'è resumeHandle = reconnect
        
        const historyResult = await loadConversationHistory(
          connectionId,
          mode,
          conversationId,
          isReconnectAttempt,
          currentAiConversationId // Pass current ID to ensure we load from correct aiConversation
        );
        
        // Extract results and assign to function-scoped variable (for use after setupComplete)
        conversationHistory = historyResult.history;
        
        // Merge saved timestamps into global set
        historyResult.savedTimestamps.forEach(ts => savedMessageTimestamps.add(ts));
        
        // Update currentAiConversationId if it was created during load
        if (historyResult.aiConversationId) {
          currentAiConversationId = historyResult.aiConversationId;
        }
        
        // 🆕 FEEDBACK PERSISTENCE: Recover pending feedback from DB (survives WebSocket reconnections)
        // If there's feedback that wasn't consumed before disconnection, restore it to RAM buffer
        if (conversation.pendingFeedback) {
          pendingFeedbackForAI = conversation.pendingFeedback;
          console.log(`\n🔄 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🔄 [${connectionId}] RECOVERED PENDING FEEDBACK FROM DB`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   📝 Feedback: "${pendingFeedbackForAI.substring(0, 100)}..."`);
          console.log(`   ⏰ Created: ${conversation.pendingFeedbackCreatedAt}`);
          console.log(`   💾 Will be injected with next user message`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
        
        // Build prospect data from conversation
        const prospectData = {
          name: conversation.prospectName,
          business: conversation.collectedData?.business,
          currentState: conversation.collectedData?.currentState,
          idealState: conversation.collectedData?.idealState,
          painPoints: conversation.collectedData?.painPoints,
          budget: conversation.collectedData?.budget,
          urgency: conversation.collectedData?.urgency,
          isDecisionMaker: conversation.collectedData?.isDecisionMaker,
        };
        
        // ✅ NEW CHUNKING APPROACH: Fix for Error 1007 (context window exceeded)
        // Minimal instruction (~800 tokens) in setup + Full context (~33k tokens) in chunks
        // This enables unlimited token capacity + automatic caching
        
        // MINIMAL system instruction - goes in setup message (under limit)
        systemInstruction = buildMinimalSalesAgentInstruction(agent);
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🆕 BUILD SCRIPT POSITION from tracker (for dynamic navigation)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let scriptPosition: ScriptPosition | undefined;
        
        if (salesTracker) {
          const trackerState = salesTracker.getState();
          const trackerStructure = salesTracker.getScriptStructure();
          
          if (trackerState && trackerStructure) {
            scriptPosition = {
              exactPhaseId: trackerState.currentPhase || 'phase_1',
              exactStepId: trackerState.currentStep || 'phase_1_step_1',
              completedPhases: trackerState.phasesReached || [],
              scriptStructure: {
                phases: trackerStructure.phases?.map((p: any) => ({
                  id: p.id,
                  number: p.number,
                  name: p.name,
                  description: p.description || '',
                  steps: p.steps?.map((s: any) => ({
                    id: s.id,
                    number: s.number,
                    name: s.name,
                    objective: s.objective || '',
                    questions: s.questions?.map((q: any) => ({
                      id: q.id,
                      text: q.text
                    })) || []
                  })) || []
                })) || [],
                metadata: {
                  totalPhases: trackerStructure.metadata?.totalPhases || 0,
                  totalSteps: trackerStructure.metadata?.totalSteps || 0
                }
              }
            };
            
            console.log(`🗺️ [${connectionId}] Script position built from tracker:`);
            console.log(`   → Current Phase: ${scriptPosition.exactPhaseId}`);
            console.log(`   → Current Step: ${scriptPosition.exactStepId}`);
            console.log(`   → Completed Phases: ${scriptPosition.completedPhases.length}`);
            console.log(`   → Total Phases in Script: ${scriptPosition.scriptStructure?.metadata.totalPhases}`);
          }
        }
        
        // FULL context - goes in chunks after setup (33k+ tokens, split into ~5 chunks)
        // Uses async version to automatically load custom scripts from database
        // 🆕 Now includes script position for dynamic navigation map
        userDataContext = await buildFullSalesAgentContextAsync(
          agent,
          prospectData,
          conversation.currentPhase,
          conversationHistory,
          scriptPosition  // 🆕 Pass exact script position
        );
        
        // Replace [NOME_PROSPECT] placeholders with actual name
        userDataContext = userDataContext.replace(/\[NOME_PROSPECT\]/g, prospectData.name);
        
        console.log(`🔄 [${connectionId}] Placeholder substitution: [NOME_PROSPECT] → "${prospectData.name}"`);
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 🎯 SALES SCRIPT TRACKING - Log FULL prompt (not truncated!)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (salesLogger) {
          const fullPrompt = systemInstruction + '\n\n' + userDataContext;
          salesLogger.logFullPrompt(fullPrompt, 'SALES AGENT FULL CONTEXT');
        }
        
        console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[${connectionId}] SALES AGENT PROMPT CONSTRUCTED (CHUNKING MODE - FIX FOR ERROR 1007)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   🤖 Agent: ${agent.agentName} (${agent.businessName})`);
        console.log(`   👤 Prospect: ${conversation.prospectName}`);
        console.log(`   📊 Phase: ${conversation.currentPhase.toUpperCase()}`);
        console.log(`   📝 Minimal system instruction: ${systemInstruction.length} chars (~${Math.round(systemInstruction.length / 4)} tokens)`);
        console.log(`   📦 Full context (to be chunked): ${userDataContext.length} chars (~${Math.round(userDataContext.length / 4)} tokens)`);
        console.log(`   📊 Expected chunks: ~${Math.ceil(userDataContext.length / 30000)} chunks (30KB each)`);
        
        // Verify minimal instruction is actually minimal
        const isMinimal = systemInstruction.length < 5000; // Should be ~3200 chars
        console.log(`   ✅ System instruction is minimal: ${isMinimal} (${systemInstruction.length} chars)`);
        
        // Verify full context contains all required sections
        const hasRules = userDataContext.includes('LE 3 REGOLE D\'ORO');
        const hasAntiSalto = userDataContext.includes('FORMULA ANTI-SALTO');
        const hasProspect = userDataContext.includes('# INFORMAZIONI SUL PROSPECT');
        const hasScripts = userDataContext.includes('SCRIPTS DI VENDITA');
        
        console.log(`   ✅ Full context contains: 3 Golden Rules: ${hasRules}`);
        console.log(`   ✅ Full context contains: Anti-Salto Formula: ${hasAntiSalto}`);
        console.log(`   ✅ Full context contains: Prospect Data: ${hasProspect}`);
        console.log(`   ✅ Full context contains: Sales Scripts: ${hasScripts}`);
        console.log(`   💾 Chunks will be automatically cached by Gemini Live API`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 📚 TRAINING SYSTEM: Log COMPLETE prompt (not truncated)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`\n╔${'═'.repeat(78)}╗`);
        console.log(`║ 📚 [TRAINING] COMPLETE SYSTEM PROMPT - SENT TO GEMINI${' '.repeat(24)} ║`);
        console.log(`╠${'═'.repeat(78)}╣`);
        console.log(`║ ConversationId: ${(conversationId || 'NULL').padEnd(57)} ║`);
        console.log(`║ Total Length: ${String(systemInstruction.length + userDataContext.length).padStart(10)} chars${' '.repeat(51)} ║`);
        console.log(`╠${'═'.repeat(78)}╣`);
        console.log(`║ PART 1: Minimal System Instruction (${systemInstruction.length} chars)${' '.repeat(34 - String(systemInstruction.length).length)} ║`);
        console.log(`╚${'═'.repeat(78)}╝\n`);
        console.log(systemInstruction);
        console.log(`\n╔${'═'.repeat(78)}╗`);
        console.log(`║ PART 2: Full Sales Agent Context (${userDataContext.length} chars)${' '.repeat(34 - String(userDataContext.length).length)} ║`);
        console.log(`╚${'═'.repeat(78)}╝\n`);
        console.log(userDataContext);
        console.log(`\n╔${'═'.repeat(78)}╗`);
        console.log(`║ 📚 [TRAINING] END OF COMPLETE PROMPT${' '.repeat(41)} ║`);
        console.log(`╚${'═'.repeat(78)}╝\n`);
      } 
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CLIENT MODE - Build prompt from user context
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      else {
        console.log(`📊 [${connectionId}] Building user context for personalized Live Mode...`);
        // Pass sessionType to buildUserContext for proper separation
        userContext = await buildUserContext(userId!, {
          message: '',
          sessionType: sessionType // 'weekly_consultation' or undefined
        });
        
        // Import the functions for Live API
        const { 
          buildMinimalSystemInstructionForLive, 
          buildFullSystemInstructionForLive,
          buildUserDataContextForLive,
          buildDynamicContextForLive  // ✅ NEW: For cache optimization
        } = await import('../ai-prompts');
        
        if (customPrompt) {
          // Custom prompt overrides everything
          systemInstruction = customPrompt;
          console.log(`📝 [${connectionId}] Using custom prompt (${customPrompt.length} characters)`);
        } else if (useFullPrompt) {
          // FULL PROMPT MODE: Minimal instruction in setup + FULL prompt in chunks
          systemInstruction = buildMinimalSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null
          );
          userDataContext = buildFullSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null,
            userContext
          );
          console.log(`📚 [${connectionId}] Using FULL PROMPT MODE (complete prompt will be sent in chunks after setup)`);
        } else {
          // ✅ OPTIMIZED MODE (default): Static instruction + dynamic context wrapper
          // This enables Context Caching (90% cost reduction on cached tokens)
          systemInstruction = buildMinimalSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null
          );
          userDataContext = buildDynamicContextForLive(userContext);
          console.log(`⚡ [${connectionId}] Using OPTIMIZED MODE (static cached prompt + dynamic context injection)`);
        }

        // Aggiungi prompt prefix per consulenze settimanali
        if (sessionType === 'weekly_consultation' && !customPrompt) {
          const consultationPrefix = `🎯 CONTESTO SESSIONE CONSULENZA SETTIMANALE:
Sei in una sessione di CONSULENZA SETTIMANALE programmata.
Durata massima: 1 ora e mezza (90 minuti).

📋 PROMPT INIZIALE (dillo SEMPRE all'inizio):
"Ehi! Benvenuto alla tua consulenza settimanale! EVVAI! 
Abbiamo 1 ora e mezza insieme per lavorare sui tuoi obiettivi.
Come ti senti oggi? Su cosa vuoi concentrarti in questa sessione?"

⏱️ GESTIONE TEMPO:
- A 75 minuti (15 min dalla fine): accenna che sta per finire il tempo
- A 85 minuti (5 min dalla fine): inizia la chiusura
- A 90 minuti: chiudi con recap veloce e saluti

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
          systemInstruction = consultationPrefix + systemInstruction;
          console.log(`🗓️ [${connectionId}] CONSULENZA SETTIMANALE - Prefix aggiunto al prompt`);
        }
      }
      
      // Log the system prompt (FULL for sales_agent minimal, truncated otherwise)
      if (customPrompt) {
        console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`┃ 🤖 CUSTOM SYSTEM PROMPT (LIVE MODE) - ${customPrompt.length} chars`);
        console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(customPrompt.substring(0, 1000) + (customPrompt.length > 1000 ? '...' : ''));
        console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      } else {
        console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`┃ 🤖 ${useFullPrompt ? 'FULL' : 'MINIMAL'} SYSTEM PROMPT (LIVE MODE) - ${systemInstruction.length} chars`);
        console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        // For Sales Agent minimal instruction, show FULL content (it's short)
        // For others, truncate to 1000 chars
        if (mode === 'sales_agent' || mode === 'consultation_invite') {
          console.log(systemInstruction);
        } else {
          console.log(systemInstruction.substring(0, 1000) + (systemInstruction.length > 1000 ? '...' : ''));
        }
        console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      }
      
      // Calculate detailed token breakdown
      const estimateTokens = (text: string) => Math.ceil(text.length / 4);
      const systemInstructionTokens = estimateTokens(systemInstruction);
      const userDataTokens = userDataContext ? estimateTokens(userDataContext) : 0;
      const totalTokens = systemInstructionTokens + userDataTokens;
      
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`📊 [${connectionId}] TOKEN BREAKDOWN - LIVE MODE`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`🎯 System Instruction: ${systemInstructionTokens.toLocaleString()} tokens`);
      if (userDataContext) {
        console.log(`📦 ${useFullPrompt ? 'Full Prompt' : 'User Data'} Context (formatted & chunked): ${userDataTokens.toLocaleString()} tokens`);
      }
      
      // Detailed breakdown ONLY for client mode (sales_agent doesn't have userContext)
      if (mode !== 'sales_agent' && userContext) {
        // Breakdown dettagliato per sezione (dai dati RAW originali)
        const financeTokens = userContext.financeData ? estimateTokens(JSON.stringify(userContext.financeData)) : 0;
        const exercisesTokens = estimateTokens(JSON.stringify(userContext.exercises));
        const libraryTokens = estimateTokens(JSON.stringify(userContext.library.documents));
        const universityTokens = estimateTokens(JSON.stringify(userContext.university));
        const consultationsTokens = estimateTokens(JSON.stringify({
          upcoming: userContext.consultations.upcoming,
          recent: userContext.consultations.recent,
          tasks: userContext.consultationTasks
        }));
        const goalsTokens = estimateTokens(JSON.stringify({
          goals: userContext.goals,
          dailyTasks: userContext.daily?.tasks || [],
          reflection: userContext.daily?.todayReflection || null
        }));
        const momentumTokens = estimateTokens(JSON.stringify({
          momentum: userContext.momentum,
          calendar: userContext.calendar
        }));
        
        // Somma totale delle sezioni (per calcolare % corrette)
        const totalSectionTokens = financeTokens + exercisesTokens + libraryTokens + universityTokens + 
                                   consultationsTokens + goalsTokens + momentumTokens;
        
        console.log(`\n📋 BREAKDOWN PER SEZIONE (dati originali RAW):`);
        console.log(`   └─ 💰 Finance Data: ${financeTokens.toLocaleString()} tokens (${((financeTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 📚 Exercises: ${exercisesTokens.toLocaleString()} tokens (${((exercisesTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 📖 Library Docs: ${libraryTokens.toLocaleString()} tokens (${((libraryTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 🎓 University: ${universityTokens.toLocaleString()} tokens (${((universityTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 💬 Consultations: ${consultationsTokens.toLocaleString()} tokens (${((consultationsTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 🎯 Goals & Tasks: ${goalsTokens.toLocaleString()} tokens (${((goalsTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ ⚡ Momentum & Calendar: ${momentumTokens.toLocaleString()} tokens (${((momentumTokens / totalSectionTokens) * 100).toFixed(1)}%)`);
        console.log(`   └─ 🎁 Totale sezioni: ${totalSectionTokens.toLocaleString()} tokens`);
        console.log(`\n💡 Nota: ${totalSectionTokens.toLocaleString()} tokens RAW → ${userDataTokens.toLocaleString()} tokens formattati (riduzione ${(((totalSectionTokens - userDataTokens) / totalSectionTokens) * 100).toFixed(1)}%)`);
      }
      
      console.log(`\n🎁 TOTAL TOKENS INVIATI (setup): ${totalTokens.toLocaleString()} tokens`);
      console.log(`${'═'.repeat(70)}\n`);

      // 3. Build Vertex AI WebSocket URL
      const wsUrl = `wss://${vertexConfig.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
      console.log(`🔗 [${connectionId}] Connecting to Vertex AI at ${vertexConfig.location}...`);

      // 4. Create raw WebSocket connection with OAuth2 Bearer token
      geminiSession = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${vertexConfig.accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // ⏱️  HELPER: Send time update to Gemini AI
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const sendTimeUpdate = () => {
        if (!geminiSession || !isSessionActive || geminiSession.readyState !== WebSocket.OPEN) {
          console.log(`⚠️  [${connectionId}] Cannot send time update - session not active`);
          return;
        }
        
        if (!sessionStartTime) {
          console.log(`⚠️  [${connectionId}] Cannot send time update - sessionStartTime not set`);
          return;
        }
        
        // Calcola tempo trascorso (con offset per sessioni riprese)
        const now = Date.now();
        const elapsedMs = now - sessionStartTime;
        const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
        const remainingMinutes = Math.max(0, CONSULTATION_DURATION_MINUTES - elapsedMinutes);
        
        // Componi messaggio in italiano
        const timeUpdateMessage = `⏱️ AGGIORNAMENTO TEMPO: Sono trascorsi ${elapsedMinutes} minuti di ${CONSULTATION_DURATION_MINUTES} minuti totali, rimangono ${remainingMinutes} minuti.`;
        
        console.log(`\n⏰ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[${connectionId}] SENDING TIME UPDATE TO GEMINI`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   Elapsed: ${elapsedMinutes} min | Remaining: ${remainingMinutes} min`);
        console.log(`   Message: "${timeUpdateMessage}"`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Invia via Gemini socket come client_content text payload
        const timeUpdatePayload = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text: timeUpdateMessage }]
              }
            ],
            turnComplete: true
          }
        };
        
        try {
          geminiSession.send(JSON.stringify(timeUpdatePayload));
          console.log(`✅ [${connectionId}] Time update sent successfully to Gemini`);
          
          // 🔍 TASK 4: Track time update in currentTurnMessages
          currentTurnMessages.push({
            type: 'TIME UPDATE - System Message',
            content: timeUpdateMessage,
            size: timeUpdateMessage.length,
            timestamp: new Date()
          });
          console.log(`🔍 [FRESH INPUT TRACKING] Time update tracked: ${timeUpdateMessage.length} chars (~${Math.round(timeUpdateMessage.length / 4)} tokens)`);
        } catch (error) {
          console.error(`❌ [${connectionId}] Error sending time update:`, error);
        }
      };

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔒 HELPER: Check for Italian greetings in text
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const containsGreeting = (text: string): boolean => {
        return GREETING_PATTERNS.some(pattern => pattern.test(text));
      };

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔒 HELPER: Trigger graceful session close
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const triggerGracefulClose = () => {
        console.log(`\n🔒 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[${connectionId}] TRIGGERING GRACEFUL CLOSE`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Stop close check interval
        if (closeCheckInterval) {
          clearInterval(closeCheckInterval);
          closeCheckInterval = null;
        }
        
        // Stop hard timeout timer
        if (hardTimeoutTimer) {
          clearTimeout(hardTimeoutTimer);
          hardTimeoutTimer = null;
        }
        
        // Notify client to execute graceful shutdown
        clientWs.send(JSON.stringify({
          type: 'session:close_now',
          message: 'Sessione terminata'
        }));
        
        console.log(`✅ [${connectionId}] Sent session:close_now to client`);
      };

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🔒 HELPER: Check 90-minute auto-close state machine
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const check90MinuteAutoClose = () => {
        if (!sessionStartTime) return;
        
        const now = Date.now();
        const elapsedMs = now - sessionStartTime;
        const elapsedMinutes = elapsedMs / (1000 * 60);
        
        // Se non siamo oltre i 90 minuti, ritorna
        if (elapsedMinutes < CONSULTATION_DURATION_MINUTES) {
          return;
        }
        
        // Trigger solo una volta
        if (!hasTriggered90MinClose) {
          hasTriggered90MinClose = true;
          
          console.log(`\n🕐 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`[${connectionId}] 90 MINUTES REACHED - TRIGGERING AUTO-CLOSE`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   Elapsed: ${elapsedMinutes.toFixed(1)} minutes`);
          console.log(`   AI Speaking: ${isAiSpeaking}`);
          console.log(`   Current state: ${closingState}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          // Notify client che stiamo chiudendo
          clientWs.send(JSON.stringify({
            type: 'session:closing',
            message: 'Sessione in chiusura, attendere il saluto finale...'
          }));
          
          // Se AI NON sta parlando, invia wrap-up prompt
          if (!isAiSpeaking) {
            console.log(`💬 [${connectionId}] AI non sta parlando - invio wrap-up prompt`);
            
            const wrapUpPrompt = "Per favore concludi la sessione con un saluto e un breve recap dei punti principali discussi oggi.";
            
            if (geminiSession && geminiSession.readyState === WebSocket.OPEN) {
              const wrapUpPayload = {
                clientContent: {
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: wrapUpPrompt }]
                    }
                  ],
                  turnComplete: true
                }
              };
              
              geminiSession.send(JSON.stringify(wrapUpPayload));
              console.log(`✅ [${connectionId}] Wrap-up prompt inviato`);
              
              // 🔍 TASK 4: Track wrap-up prompt in currentTurnMessages
              currentTurnMessages.push({
                type: 'WRAP-UP PROMPT - System Message',
                content: wrapUpPrompt,
                size: wrapUpPrompt.length,
                timestamp: new Date()
              });
              console.log(`🔍 [FRESH INPUT TRACKING] Wrap-up prompt tracked: ${wrapUpPrompt.length} chars (~${Math.round(wrapUpPrompt.length / 4)} tokens)`);
              
              closingState = 'waiting_ai_finish';
            }
          } else {
            // AI sta già parlando, aspetta che finisca
            console.log(`🎤 [${connectionId}] AI sta parlando - aspetto che finisca`);
            closingState = 'waiting_ai_finish';
          }
          
          // HARD TIMEOUT FAILSAFE: forza chiusura dopo 30 secondi
          hardTimeoutTimer = setTimeout(() => {
            console.warn(`\n⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.warn(`[${connectionId}] HARD TIMEOUT REACHED (30s)`);
            console.warn(`   Forcing close without waiting for greeting`);
            console.warn(`   State was: ${closingState}`);
            console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            triggerGracefulClose();
          }, 30000); // 30 secondi
          
          // Avvia check interval per monitorare stato
          closeCheckInterval = setInterval(() => {
            // Se AI ha finito di parlare e abbiamo rilevato saluto, chiudi
            if (closingState === 'ready_to_close') {
              triggerGracefulClose();
            }
          }, 1000); // Check ogni secondo
        }
      };

      // 5. Setup WebSocket event handlers
      geminiSession.on('open', () => {
        console.log(`✅ [${connectionId}] Gemini Live WebSocket opened`);
        isSessionActive = true;
        
        // ⏱️  VERIFY SESSION START TIME (già inizializzato PRIMA del socket open)
        if (sessionType === 'weekly_consultation') {
          if (sessionStartTime) {
            const now = Date.now();
            const elapsed = Math.floor((now - sessionStartTime) / (1000 * 60));
            console.log(`⏱️  [${connectionId}] ✅ Session start time verified: ${new Date(sessionStartTime).toISOString()}`);
            console.log(`   → Elapsed since initialization: ${elapsed} minutes`);
            console.log(`   → Timer is ready to send updates`);
          } else {
            console.error(`❌ [${connectionId}] CRITICAL: sessionStartTime NOT initialized for weekly consultation!`);
          }
        }
        
        // Send setup message to Gemini Live API
        // ✅ FIX RESUME: Omit system_instruction field entirely when resuming
        // Using conditional object spread to avoid sending undefined/null
        const setupMessage: any = {
          setup: {
            model: `projects/${vertexConfig.projectId}/locations/${vertexConfig.location}/publishers/google/models/${vertexConfig.modelId}`,
            generation_config: {
              response_modalities: ["AUDIO"],
              speech_config: {
                language_code: "it-IT",
                voice_config: {
                  prebuilt_voice_config: {
                    voice_name: voiceName
                  }
                }
              },
              temperature: 1.0,
              top_p: 0.95,
              top_k: 40,
              max_output_tokens: 8192  // Permetti risposte più lunghe per monologhi/spiegazioni dettagliate
            },
            input_audio_transcription: {},
            output_audio_transcription: {},
            // Conditionally include system_instruction ONLY on new sessions
            ...(!validatedResumeHandle && {
              system_instruction: {
                parts: [
                  {
                    text: systemInstruction
                  }
                ]
              }
            }),
            // 🎙️ BARGE-IN: Automatic Voice Activity Detection (VAD) for natural interruptions
            // Documentation: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/multimodal-live#automaticactivitydetection
            // When user speaks while AI is talking, Gemini sends `interrupted: true` in serverContent
            // ⚙️ OPTIMIZED: HIGH sensitivity for instant interruptions (like real phone calls)
            // Supported values: LOW = only clear speech (slower interruption), HIGH = instant detection (natural conversation)
            realtime_input_config: {
              automatic_activity_detection: {
                disabled: false,  // Enable automatic VAD
                start_of_speech_sensitivity: 'START_SENSITIVITY_HIGH',  // HIGH = instant barge-in when user starts speaking
                end_of_speech_sensitivity: 'END_SENSITIVITY_HIGH',      // HIGH = force frequent chunks for word-by-word transcription
                prefix_padding_ms: 300,        // Capture speech onset (300ms recommended)
                silence_duration_ms: 2000       // Balanced silence detection for natural word boundaries
              }
            },
            // Enable session resumption for unlimited session duration
            // CRITICAL: Always pass { handle: value } - null for new sessions, token for resuming
            session_resumption: { handle: validatedResumeHandle || null },
            // Enable context window compression for unlimited conversation length
            context_window_compression: {
              sliding_window: {}
            }
          }
        };
        
        console.log(`🎙️ [${connectionId}] Using voice: ${voiceName}`);
        console.log(`🤖 [${connectionId}] Model: ${vertexConfig.modelId} - Language: ITALIAN ONLY`);
        if (validatedResumeHandle) {
          console.log(`🔄 [${connectionId}] RESUMING SESSION with handle: ${validatedResumeHandle.substring(0, 20)}...`);
        } else {
          console.log(`🆕 [${connectionId}] STARTING NEW SESSION (session resumption enabled for unlimited duration)`);
        }
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        const setupMessageStr = JSON.stringify(setupMessage, null, 2);
        console.log(`📤 [${connectionId}] SETUP MESSAGE BEING SENT TO GEMINI:`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(setupMessageStr.substring(0, 1000) + (setupMessageStr.length > 1000 ? '...' : ''));
        console.log(`\n📊 Setup Message Stats:`);
        console.log(`   - Model path: ${setupMessage.setup.model}`);
        console.log(`   - System instruction length: ${systemInstruction.length} chars (always minimal)`);
        console.log(`   - Prompt mode: ${useFullPrompt ? 'FULL (complete prompt in chunks)' : 'MINIMAL (user data in chunks)'}`);
        console.log(`   - Response modalities: ${setupMessage.setup.generation_config.response_modalities.join(', ')}`);
        console.log(`   - Voice: ${setupMessage.setup.generation_config.speech_config.voice_config.prebuilt_voice_config.voice_name}`);
        console.log(`   - Language: ${setupMessage.setup.generation_config.speech_config.language_code}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // 🔍 DEBUG: Track system instruction for "Fresh Text Input" analysis
        if (!validatedResumeHandle && setupMessage.setup.system_instruction) {
          const sysInstText = setupMessage.setup.system_instruction.parts[0].text;
          currentTurnMessages.push({
            type: 'SETUP - System Instruction (NON-CACHED)',
            content: sysInstText.substring(0, 500) + '...',
            size: sysInstText.length,
            timestamp: new Date()
          });
          console.log(`🔍 [FRESH INPUT TRACKING] System Instruction: ${sysInstText.length} chars (~${Math.round(sysInstText.length / 4)} tokens) - WILL BE COUNTED AS FRESH TEXT INPUT`);
        }
        
        // 1. Send setup message
        geminiSession.send(JSON.stringify(setupMessage));
        
        // ✅ FIX CACHE OPTIMIZATION: Send dynamic context IMMEDIATELY after setup
        // Not after setupComplete - this ensures cache stays warm and timing is deterministic
        const isResuming = !!validatedResumeHandle;
        
        if (userDataContext && !isResuming) {
          console.log(`\n📤 [${connectionId}] Sending dynamic context IMMEDIATELY after setup (cache optimization)...`);
          console.log(`   Type: ${useFullPrompt ? 'FULL PROMPT' : 'OPTIMIZED DYNAMIC CONTEXT'}`);
          console.log(`   Size: ${userDataContext.length} chars (~${Math.round(userDataContext.length / 4)} tokens)`);
          
          // Split into chunks of ~30KB each
          const CHUNK_SIZE = 30 * 1024;
          const chunks: string[] = [];
          for (let i = 0; i < userDataContext.length; i += CHUNK_SIZE) {
            chunks.push(userDataContext.substring(i, i + CHUNK_SIZE));
          }
          
          console.log(`   Total chunks to send: ${chunks.length}\n`);
          
          // 🔍 TASK 1 & 2: Log detailed breakdown of each chunk + Track in currentTurnMessages
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📦 CHUNK BREAKDOWN (sent BEFORE AI can speak):`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          let totalChunkTokens = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const estimatedTokens = Math.round(chunk.length / 4);
            totalChunkTokens += estimatedTokens;
            
            // Detailed preview (500 chars start + 500 chars end)
            const startPreview = chunk.substring(0, 500).replace(/\n/g, ' ').trim();
            const endPreview = chunk.substring(Math.max(0, chunk.length - 500)).replace(/\n/g, ' ').trim();
            
            console.log(`\n   📦 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`   📦 CHUNK ${i + 1}/${chunks.length}`);
            console.log(`   📦 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`      📏 Size: ${chunk.length.toLocaleString()} chars (~${estimatedTokens.toLocaleString()} tokens)`);
            console.log(`      🔢 Chunk position: ${i * CHUNK_SIZE} - ${Math.min((i + 1) * CHUNK_SIZE, userDataContext.length)}`);
            console.log(`\n      ▶️  FIRST 500 CHARS:`);
            console.log(`      "${startPreview}${chunk.length > 500 ? '...' : ''}"`);
            console.log(`\n      ◀️  LAST 500 CHARS:`);
            console.log(`      "${chunk.length > 500 ? '...' : ''}${endPreview}"`);
            
            // Check what sections this chunk contains
            const containsChecks = [
              { name: 'Golden Rules', check: chunk.includes('LE 3 REGOLE D\'ORO') || chunk.includes('REGOLA #') },
              { name: 'Anti-Salto Formula', check: chunk.includes('FORMULA ANTI-SALTO') || chunk.includes('ANTI-SALTO') },
              { name: 'Sales Scripts', check: chunk.includes('SCRIPTS DI VENDITA') || chunk.includes('SCRIPT #') },
              { name: 'Discovery Script', check: chunk.includes('SCRIPT #1: DISCOVERY') || chunk.includes('DISCOVERY') },
              { name: 'Objection Script', check: chunk.includes('OBIEZIONI') },
              { name: 'Closing Script', check: chunk.includes('CHIUSURA') },
              { name: 'Prospect Data', check: chunk.includes('INFORMAZIONI SUL PROSPECT') || chunk.includes('Nome:') },
              { name: 'Conversation History', check: chunk.includes('CRONOLOGIA CONVERSAZIONE') || chunk.includes('USER:') || chunk.includes('ASSISTANT:') },
              { name: 'Agent Instructions', check: chunk.includes('ISTRUZIONI') || chunk.includes('COMPORTAMENTO') }
            ];
            
            const foundSections = containsChecks.filter(c => c.check).map(c => c.name);
            if (foundSections.length > 0) {
              console.log(`\n      📋 SECTIONS IN THIS CHUNK: ${foundSections.join(', ')}`);
            }
            
            // 🔍 TASK 2: Track chunk in currentTurnMessages for fresh text input analysis
            currentTurnMessages.push({
              type: `CHUNK ${i + 1}/${chunks.length} - User Data Context (SHOULD BE CACHED)`,
              content: `${startPreview.substring(0, 200)}... [TOTAL: ${chunk.length} chars] ...${endPreview.substring(endPreview.length - 200)}`,
              size: chunk.length,
              timestamp: new Date()
            });
            
            console.log(`      ✅ Chunk tracked in currentTurnMessages for fresh input analysis`);
            console.log(`   📦 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          }
          
          // 🔍 TASK 5: Save initial chunk tokens for comparison report
          sessionInitialChunkTokens = totalChunkTokens;
          
          console.log(`   📊 TOTAL CHUNKS SUMMARY:`);
          console.log(`      • Total chunks: ${chunks.length}`);
          console.log(`      • Total size: ${userDataContext.length.toLocaleString()} chars`);
          console.log(`      • Estimated tokens: ~${totalChunkTokens.toLocaleString()} tokens`);
          console.log(`      • All chunks tracked in currentTurnMessages`);
          console.log(`      • 🔍 Saved to sessionInitialChunkTokens for comparison report`);
          console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`⏳ Sending chunks to Gemini Live API...`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          // 🔍 TASK 7: Send data chunks FIRST, then primer chunk LAST
          console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🎯 TASK 7: CACHE OPTIMIZATION EXPERIMENT - Primer Chunk at END`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   💡 Strategy: Send all ${chunks.length} data chunks FIRST`);
          console.log(`   💡 Then: Send minimal primer chunk LAST (with turnComplete: true)`);
          console.log(`   💡 Goal: Test if this order enables better caching`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          // Send all content chunks FIRST (all with turnComplete: false)
          for (let i = 0; i < chunks.length; i++) {
            const chunkTokens = Math.round(chunks[i].length / 4);
            const chunkMessage = {
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{ text: chunks[i] }]
                }],
                turnComplete: false // NOT the last chunk
              }
            };
            geminiSession.send(JSON.stringify(chunkMessage));
            console.log(`   ✅ Chunk ${i + 1}/${chunks.length} sent - ${chunks[i].length} chars (~${chunkTokens.toLocaleString()} tokens)`);
          }
          
          // Send primer chunk LAST with turnComplete: true
          // 🆕 TASK 7: Istruzione per aspettare che il cliente parli per primo
          const primerContent = `📋 CONTEXT_END - All user data loaded and ready.

🚨 REGOLA CRITICA - ASPETTA IL CLIENTE:
NON iniziare a parlare tu per primo!
ASPETTA che il cliente dica qualcosa (anche solo "pronto" o "ciao").
Solo DOPO che il cliente ha parlato, puoi iniziare con il benvenuto.
Se il cliente non parla entro 5 secondi, puoi fare un breve "Buongiorno, mi senti?"
MA NON iniziare con lo script completo finché il cliente non risponde!`;
          
          const primerTokens = Math.round(primerContent.length / 4);
          const primerMessage = {
            clientContent: {
              turns: [{
                role: 'user',
                parts: [{ text: primerContent }]
              }],
              turnComplete: true // FINAL chunk completes the turn
            }
          };
          geminiSession.send(JSON.stringify(primerMessage));
          console.log(`\n   🎯 Primer chunk sent (FINAL) - ${primerContent.length} chars (~${primerTokens} tokens)`);
          console.log(`   ✅ Turn complete with primer at END`);
          console.log(`   🚨 AI instructed to WAIT for client to speak first\n`);
          
          // Track primer in currentTurnMessages
          currentTurnMessages.push({
            type: 'PRIMER CHUNK at END - Cache Optimization (TASK 7 v2)',
            content: primerContent,
            size: primerContent.length,
            timestamp: new Date()
          });
          
          console.log(`\n🎉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`✅ [${connectionId}] ALL ${chunks.length} CHUNKS SENT & LOADED`);
          console.log(`   💾 Chunks are now CACHED by Gemini Live API (90% cost savings on next turn!)`);
          console.log(`   🎙️ AI can now speak (has complete context: ${Math.round(userDataContext.length / 4)} tokens)`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        } else if (isResuming) {
          console.log(`\n⏩ [${connectionId}] RESUMING - Skipping dynamic context (preserved in session)`);
        }
      });

      geminiSession.on('message', async (data: Buffer) => {
        if (!isSessionActive) return;
        
        try {
          const response = JSON.parse(data.toString());
          // Log ridotto - non logghiamo ogni singolo response, solo eventi importanti
          
          // Setup complete response
          if (response.setupComplete) {
            console.log(`✅ [${connectionId}] Gemini Live session ready`);
            clientWs.send(JSON.stringify({ 
              type: 'ready',
              message: 'Gemini Live session ready',
              voice: voiceName
            }));
            
            // ⏱️  SYNC TIMER: Send session start time to client (for weekly consultations)
            // This ensures frontend timer shows correct elapsed time after browser reload
            if (sessionType === 'weekly_consultation' && sessionStartTime) {
              const now = Date.now();
              const elapsedMs = now - sessionStartTime;
              const elapsedSeconds = Math.floor(elapsedMs / 1000);
              
              console.log(`\n⏱️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`⏱️  [${connectionId}] SENDING SESSION TIME SYNC TO CLIENT`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`   → Session start time: ${new Date(sessionStartTime).toISOString()}`);
              console.log(`   → Elapsed: ${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`);
              console.log(`   → This ensures UI timer syncs after browser reload`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // Send authoritative session time to frontend
              clientWs.send(JSON.stringify({
                type: 'session:time_sync',
                sessionStartTime: sessionStartTime,
                elapsedSeconds: elapsedSeconds
              }));
            }
            
            // ⏱️  START TIMER for Weekly Consultations
            if (sessionType === 'weekly_consultation' && sessionStartTime) {
              // Invia subito il primo aggiornamento (a 0 minuti)
              console.log(`⏱️  [${connectionId}] Starting time update scheduler for consultation...`);
              sendTimeUpdate();
              
              // Avvia interval per aggiornamenti ogni 10 minuti
              timeUpdateInterval = setInterval(() => {
                sendTimeUpdate();
                // 🔒 Check 90-minute auto-close after each time update
                check90MinuteAutoClose();
              }, TIME_UPDATE_INTERVAL_MS);
              
              console.log(`✅ [${connectionId}] Time update scheduler started (every ${TIME_UPDATE_INTERVAL_MS / 1000 / 60} minutes)`);
              console.log(`🔒 [${connectionId}] 90-minute auto-close mechanism enabled`);
            }
            
            // ✅ OPTIMIZATION: Dynamic context already sent immediately after setup (see 'open' handler)
            // Now we just notify client that session is ready
            const isResuming = !!validatedResumeHandle;
            
            if (isResuming) {
              // SESSION RESUMPTION: Notify client about successful reconnection
              clientWs.send(JSON.stringify({
                type: 'session:resumed',
                message: 'Connessione ripristinata con successo',
                contextPreserved: true,
                timestamp: new Date().toISOString()
              }));
              console.log(`✅ [${connectionId}] Sent 'session:resumed' to client`);
            }
            
            // Notify client session is ready (both new and resumed sessions)
            clientWs.send(JSON.stringify({
              type: 'chunks_complete',
              message: isResuming ? 'Session resumed, context preserved.' : 'Dynamic context loaded, ready to listen'
            }));
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📚 RESTORE CONVERSATION HISTORY (for sales_agent/consultation_invite modes)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // After setup is complete and chunks are sent, restore the conversation
            // history by sending all previous messages as separate clientContent messages.
            // This ensures Gemini Live has the complete conversation context.
            // 
            // OPTIMIZATION: Skip Gemini replay if using session resumption (already has context)
            // Database is ALWAYS loaded above (needed for prompt/persistence), but we skip
            // the expensive resend to Gemini when session handle is present.
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            
            // Check if we should replay history to Gemini
            const shouldReplayHistory = (mode === 'sales_agent' || mode === 'consultation_invite') && 
                                        conversationHistory && 
                                        conversationHistory.length > 0 &&
                                        !validatedResumeHandle; // SKIP replay if using session resumption
            
            if (validatedResumeHandle && conversationHistory && conversationHistory.length > 0) {
              // SESSION RESUMPTION: Skip expensive replay to Gemini
              console.log(`\n╔${'═'.repeat(78)}╗`);
              console.log(`║ 🔄 [${connectionId}] SESSION RESUMPTION - Skipping Gemini history replay ${' '.repeat(18)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ ✅ Gemini restored context from session handle (FREE)${' '.repeat(23)} ║`);
              console.log(`║ ⚡ Skipped resending ${conversationHistory.length} messages - saves ~$0.05 per reconnect${' '.repeat(19 - String(conversationHistory.length).length)} ║`);
              console.log(`║ 📊 Database loaded: ${conversationHistory.length} messages (needed for prompt/persistence)${' '.repeat(15 - String(conversationHistory.length).length)} ║`);
              console.log(`╚${'═'.repeat(78)}╝\n`);
              
              // 🆕 TASK 7 & 8: After resume, tell AI to WAIT for client and NOT speak first
              // This prevents double questions/greetings after resume
              const resumeInstruction = `
🔄 SESSIONE RIPRESA - ISTRUZIONI POST-RESUME:
La connessione è stata ripresa dopo un'interruzione.
⚠️ NON iniziare a parlare subito!
⚠️ NON fare il benvenuto di nuovo - lo hai già fatto prima.
⚠️ ASPETTA che il cliente dica qualcosa.
Solo quando il cliente parla, rispondi brevemente e continua da dove eri rimasto.
Se il cliente dice "pronto?" o "ci sei?", rispondi "Sì, sono qui! Scusa per l'interruzione. Dove eravamo rimasti?"
`;
              
              const resumeMessage = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: resumeInstruction }]
                  }],
                  turnComplete: true
                }
              };
              geminiSession.send(JSON.stringify(resumeMessage));
              console.log(`🚨 [${connectionId}] Post-resume instruction sent: WAIT for client, no double greeting`);
              
              // 🆕 TASK 8: Reset prospectHasSpoken dopo resume
              // Questo forza il prospect a parlare di nuovo prima che l'AI possa generare output
              prospectHasSpoken = false;
              aiOutputBuffered = 0;
              console.log(`🔄 [${connectionId}] TASK 8 RESET: prospectHasSpoken = false (require prospect to speak again)`);
            }
            
            if (shouldReplayHistory) {
              
              console.log(`\n╔${'═'.repeat(78)}╗`);
              console.log(`║ 📚 [${connectionId}] RESTORING CONVERSATION HISTORY TO GEMINI LIVE ${' '.repeat(18)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ Total messages to send: ${String(conversationHistory.length).padEnd(49)} ║`);
              console.log(`║ First message: ${conversationHistory[0].timestamp.toLocaleTimeString('it-IT').padEnd(59)} ║`);
              console.log(`║ Last message: ${conversationHistory[conversationHistory.length - 1].timestamp.toLocaleTimeString('it-IT').padEnd(60)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ NOTE: Sending messages as clientContent to restore conversation context    ║`);
              console.log(`╚${'═'.repeat(78)}╝\n`);
              
              // Send each historical message as a separate clientContent turn
              for (let i = 0; i < conversationHistory.length; i++) {
                const msg = conversationHistory[i];
                const preview = msg.content.substring(0, 60).replace(/\n/g, ' ');
                
                const historyMessage = {
                  clientContent: {
                    turns: [
                      {
                        role: msg.role,
                        parts: [{ text: msg.content }]
                      }
                    ],
                    turnComplete: true
                  }
                };
                
                geminiSession.send(JSON.stringify(historyMessage));
                console.log(`✅ [${connectionId}] Sent msg ${i + 1}/${conversationHistory.length} (${msg.role}): "${preview}${msg.content.length > 60 ? '...' : ''}"`);
                
                // 🔍 TASK 4: Track history message in currentTurnMessages
                currentTurnMessages.push({
                  type: `HISTORY MESSAGE ${i + 1}/${conversationHistory.length} - ${msg.role} (SHOULD BE CACHED after first turn)`,
                  content: `${preview}${msg.content.length > 60 ? '...' : ''}`,
                  size: msg.content.length,
                  timestamp: new Date()
                });
                
                // Small delay between messages to avoid rate limits
                if (i < conversationHistory.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }
              
              console.log(`\n╔${'═'.repeat(78)}╗`);
              console.log(`║ 🎉 [${connectionId}] CONVERSATION HISTORY RESTORED SUCCESSFULLY ${' '.repeat(23)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ Gemini Live now has complete context of previous ${conversationHistory.length} messages${' '.repeat(20 - String(conversationHistory.length).length)} ║`);
              console.log(`║ AI can continue conversation from where it was interrupted${' '.repeat(17)} ║`);
              console.log(`╚${'═'.repeat(78)}╝\n`);
              
              // Notify client that history restoration is complete
              clientWs.send(JSON.stringify({
                type: 'history_restored',
                message: 'Conversazione ripristinata con successo',
                messagesRestored: conversationHistory.length
              }));
            }
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 💾 START AUTOSAVE INTERVAL (Sales Agent / Consultation Invite only)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if ((mode === 'sales_agent' || mode === 'consultation_invite') && currentAiConversationId) {
              console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`[${connectionId}] STARTING AUTOSAVE INTERVAL`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`   Mode: ${mode}`);
              console.log(`   Interval: ${AUTOSAVE_INTERVAL_MS / 1000} seconds`);
              console.log(`   aiConversationId: ${currentAiConversationId}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // Autosave every 30 seconds
              autosaveInterval = setInterval(async () => {
                try {
                  // Only save if there are new messages
                  const newMessages = conversationMessages.filter(m => !savedMessageTimestamps.has(m.timestamp));
                  
                  if (newMessages.length === 0) {
                    console.log(`💾 [${connectionId}] Autosave: No new messages to save (${conversationMessages.length} total, all persisted)`);
                    return;
                  }
                  
                  console.log(`💾 [${connectionId}] Autosave: Saving ${newMessages.length} new messages...`);
                  
                  // Buffer timestamps locally
                  const tempTimestamps: string[] = [];
                  
                  // Use transaction for atomicity
                  await db.transaction(async (tx) => {
                    for (const msg of newMessages) {
                      await tx.insert(aiMessages).values({
                        conversationId: currentAiConversationId!,
                        role: msg.role,
                        content: msg.transcript,
                        messageType: 'voice',
                        durationSeconds: msg.duration,
                        status: 'completed',
                        createdAt: new Date(msg.timestamp)
                      });
                      
                      tempTimestamps.push(msg.timestamp);
                    }
                    
                    // Update lastMessageAt
                    await tx.update(aiConversations)
                      .set({ 
                        lastMessageAt: new Date(),
                        updatedAt: new Date()
                      })
                      .where(eq(aiConversations.id, currentAiConversationId!));
                  });
                  
                  // Mark as saved
                  tempTimestamps.forEach(ts => savedMessageTimestamps.add(ts));
                  
                  console.log(`✅ [${connectionId}] Autosave: ${newMessages.length} messages saved successfully (total saved: ${savedMessageTimestamps.size}/${conversationMessages.length})`);
                } catch (error: any) {
                  console.error(`❌ [${connectionId}] Autosave failed:`, error.message);
                  // Continue - don't crash the session on autosave failure
                }
              }, AUTOSAVE_INTERVAL_MS);
              
              console.log(`✅ [${connectionId}] Autosave interval started - will save every ${AUTOSAVE_INTERVAL_MS / 1000} seconds`);
            }
            
            return;
          }

          // goAway notification - Gemini avvisa 60s prima della chiusura (timeout 10 minuti)
          if (response.goAway) {
            console.log(`\n⚠️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⏰ [${connectionId}] GO AWAY NOTIFICATION RECEIVED`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Reason: ${JSON.stringify(response.goAway)}`);
            console.log(`⚠️  Session will close in ~60 seconds due to 10-minute timeout`);
            console.log(`💡 User should see a notification to continue the conversation`);
            
            // PROACTIVE SESSION RESUMPTION: Send session handle immediately for seamless reconnect
            if (lastSessionHandle) {
              console.log(`🔄 PROACTIVE: Sending last session handle to client for seamless reconnect`);
              console.log(`   → Handle preview: ${lastSessionHandle.substring(0, 20)}...`);
              // Send handle update immediately so client is prepared
              clientWs.send(JSON.stringify({
                type: 'session_resumption_update',
                handle: lastSessionHandle,
                resumable: true
              }));
            } else {
              console.log(`⚠️  WARNING: No session handle available for reconnect!`);
            }
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // Notifica il client che la sessione sta per scadere
            clientWs.send(JSON.stringify({
              type: 'session_expiring',
              message: 'La sessione sta per scadere tra ~60 secondi. Concludi la conversazione.',
              timeLeft: 60,
              hasHandle: !!lastSessionHandle // Inform client if we have a handle ready
            }));
          }

          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 💰 USAGE METADATA - Token/Audio tracking with Cache Optimization
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          if (response.usageMetadata) {
            const usage = response.usageMetadata;
            const inputTokens = usage.promptTokenCount || 0; // Fresh text input tokens
            const outputTokens = usage.candidatesTokenCount || 0; // Audio output tokens
            const cachedTokens = usage.cachedContentTokenCount || 0; // Cached input tokens (94% savings!)
            
            // 🔬 DEBUG: Log FULL usageMetadata to see if there are hidden fields
            console.log(`\n🔬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🔬 FULL GEMINI usageMetadata (to see ALL available fields):`);
            console.log(JSON.stringify(usage, null, 2));
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // Audio metrics (if available in metadata)
            const audioInputSeconds = usage.audioInputSeconds || 0;
            const audioOutputSeconds = usage.audioOutputSeconds || 0;
            
            // 🔍 TASK 3 & 4: Log detailed "Fresh Text Input" breakdown + Cache analysis
            if (inputTokens > 0 || cachedTokens > 0) {
              console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🔍 [FRESH TEXT INPUT BREAKDOWN] - ${inputTokens.toLocaleString()} tokens ($0.50/1M)`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              
              if (currentTurnMessages.length > 0) {
                console.log(`📋 Messages sent in this turn:`);
                let totalChars = 0;
                let chunkCount = 0;
                currentTurnMessages.forEach((msg, idx) => {
                  console.log(`   ${idx + 1}. ${msg.type}`);
                  console.log(`      Size: ${msg.size.toLocaleString()} chars (~${Math.round(msg.size / 4)} tokens)`);
                  console.log(`      Preview: "${msg.content}"`);
                  console.log(`      Sent at: ${msg.timestamp.toISOString()}`);
                  totalChars += msg.size;
                  if (msg.type.includes('CHUNK')) chunkCount++;
                });
                console.log(`\n   📊 TOTAL SENT: ${totalChars.toLocaleString()} chars (~${Math.round(totalChars / 4)} estimated tokens)`);
                console.log(`   📊 ACTUAL FRESH INPUT TOKENS: ${inputTokens.toLocaleString()} tokens`);
                console.log(`   💡 Difference: ~${inputTokens - Math.round(totalChars / 4)} tokens (due to encoding/system overhead)`);
                
                // 🔍 TASK 3: Chunk-specific cache analysis
                if (chunkCount > 0) {
                  console.log(`\n   🎯 CHUNK ANALYSIS:`);
                  console.log(`      • Chunks sent: ${chunkCount}`);
                  console.log(`      • Expected to be CACHED after first turn`);
                  console.log(`      • If this is NOT the first turn, these should appear as CACHED tokens, not FRESH!`);
                }
              } else {
                console.log(`⚠️  No messages tracked in current turn`);
                console.log(`   This might be audio-only input or system messages`);
              }
              
              // 🔍 TASK 3: DETAILED CACHE ANALYSIS
              console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`💾 CACHE PERFORMANCE ANALYSIS`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              
              if (cachedTokens > 0) {
                console.log(`✅ CACHED TOKENS DETECTED: ${cachedTokens.toLocaleString()} tokens`);
                console.log(`   💰 Cost: $${((cachedTokens / 1_000_000) * 0.03).toFixed(6)} ($0.03/1M)`);
                console.log(`   💸 Savings vs Fresh: $${((cachedTokens / 1_000_000) * (0.50 - 0.03)).toFixed(6)} (94% reduction!)`);
                
                // Check if cached amount matches expected chunks
                const expectedChunkTokens = Math.round(totalChars / 4);
                if (expectedChunkTokens > 0) {
                  const cacheRatio = (cachedTokens / expectedChunkTokens) * 100;
                  console.log(`\n   📊 Cache Coverage:`);
                  console.log(`      • Expected to cache: ~${expectedChunkTokens.toLocaleString()} tokens (from sent chunks)`);
                  console.log(`      • Actually cached: ${cachedTokens.toLocaleString()} tokens`);
                  console.log(`      • Coverage: ${cacheRatio.toFixed(1)}%`);
                  
                  if (cacheRatio < 50) {
                    console.log(`      ⚠️  WARNING: Cache coverage is LOW! Chunks might not be caching properly.`);
                  } else if (cacheRatio > 90) {
                    console.log(`      ✅ EXCELLENT: Cache is working as expected!`);
                  }
                }
              } else {
                console.log(`❌ NO CACHED TOKENS DETECTED`);
                console.log(`   ⚠️  This is expected ONLY for the FIRST turn after setup.`);
                console.log(`   ⚠️  If this is NOT the first turn, CHUNKS ARE NOT BEING CACHED!`);
                console.log(`   💸 Missing out on 94% cost savings!`);
              }
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              
              console.log(`\n💰 COST BREAKDOWN:`);
              console.log(`   Fresh Text Input: ${inputTokens.toLocaleString()} tokens × $0.50/1M = $${((inputTokens / 1_000_000) * 0.50).toFixed(6)}`);
              if (cachedTokens > 0) {
                console.log(`   Cached Input: ${cachedTokens.toLocaleString()} tokens × $0.03/1M = $${((cachedTokens / 1_000_000) * 0.03).toFixed(6)} ⚡ (94% savings!)`);
              }
              if (audioInputSeconds > 0) {
                console.log(`   Audio Input: ${audioInputSeconds.toFixed(2)}s × 32k tokens/s × $3.00/1M = $${((audioInputSeconds * 32000 / 1_000_000) * 3.00).toFixed(6)}`);
              }
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // Reset turn messages after logging
              currentTurnMessages = [];
            }
            
            // Update cumulative totals
            totalInputTokens += inputTokens;
            totalOutputTokens += outputTokens;
            totalCachedTokens += cachedTokens;
            totalAudioInputSeconds += audioInputSeconds;
            totalAudioOutputSeconds += audioOutputSeconds;
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 💵 ACCURATE COST CALCULATION - Official Live API pricing
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // Breakdown: Cached ($0.03/1M), Text Input ($0.50/1M), Audio Input ($3.00/1M), Audio Output ($12.00/1M)
            
            // This turn costs
            const cachedCost = (cachedTokens / 1_000_000) * PRICE_CACHED_PER_1M;
            const textInputCost = (inputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
            const audioInputCost = (audioInputSeconds * 32000 / 1_000_000) * PRICE_AUDIO_INPUT_PER_1M; // 32k tokens/sec for audio
            const audioOutputCost = (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M; // Output is always audio
            const turnCost = cachedCost + textInputCost + audioInputCost + audioOutputCost;
            
            // Session totals
            const totalCachedCost = (totalCachedTokens / 1_000_000) * PRICE_CACHED_PER_1M;
            const totalTextInputCost = (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
            const totalAudioInputCost = (totalAudioInputSeconds * 32000 / 1_000_000) * PRICE_AUDIO_INPUT_PER_1M;
            const totalAudioOutputCost = (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
            const sessionCost = totalCachedCost + totalTextInputCost + totalAudioInputCost + totalAudioOutputCost;
            
            // Calculate cache hit rate and savings
            const totalInputWithCache = totalInputTokens + totalCachedTokens;
            const cacheHitRate = totalInputWithCache > 0 ? (totalCachedTokens / totalInputWithCache) * 100 : 0;
            const costWithoutCache = (totalCachedTokens / 1_000_000) * PRICE_INPUT_PER_1M; // What we would pay without cache
            const cacheSavings = costWithoutCache - totalCachedCost; // Actual savings (94% reduction)
            
            console.log(`\n💰 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 [${connectionId}] LIVE API USAGE & COST (with Cache Optimization)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📥 This turn:`);
            if (cachedTokens > 0) {
              console.log(`   🎯 Cached Input: ${cachedTokens.toLocaleString()} tokens → $${cachedCost.toFixed(6)} ($0.03/1M) ⚡ 94% SAVINGS!`);
            }
            console.log(`   - Fresh Text Input: ${inputTokens.toLocaleString()} tokens → $${textInputCost.toFixed(6)} ($0.50/1M)`);
            if (audioInputSeconds > 0) {
              console.log(`   - Audio Input: ${audioInputSeconds.toFixed(2)}s → $${audioInputCost.toFixed(6)} ($3.00/1M tokens)`);
            }
            console.log(`   - Audio Output: ${outputTokens.toLocaleString()} tokens → $${audioOutputCost.toFixed(6)} ($12.00/1M) 💸 Most expensive!`);
            console.log(`   - Turn total: $${turnCost.toFixed(6)} USD`);
            console.log(`\n📊 Session totals:`);
            if (totalCachedTokens > 0) {
              console.log(`   🎯 Cached: ${totalCachedTokens.toLocaleString()} tokens → $${totalCachedCost.toFixed(6)} (Cache Hit: ${cacheHitRate.toFixed(1)}%)`);
              console.log(`   💰 Cache Savings: $${cacheSavings.toFixed(6)} saved vs fresh tokens!`);
            }
            console.log(`   - Text Input: ${totalInputTokens.toLocaleString()} tokens → $${totalTextInputCost.toFixed(6)}`);
            if (totalAudioInputSeconds > 0) {
              console.log(`   - Audio Input: ${totalAudioInputSeconds.toFixed(2)}s → $${totalAudioInputCost.toFixed(6)}`);
            }
            console.log(`   - Audio Output: ${totalOutputTokens.toLocaleString()} tokens → $${totalAudioOutputCost.toFixed(6)}`);
            console.log(`   - SESSION TOTAL: $${sessionCost.toFixed(6)} USD`);
            
            // 🔍 TASK 5: COMPARISON REPORT - Expected vs Actual token usage
            if (sessionInitialChunkTokens > 0) {
              console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🔍 TASK 5: TOKEN USAGE COMPARISON REPORT`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`📦 Initial Chunks Sent:`);
              console.log(`   • Estimated tokens: ${sessionInitialChunkTokens.toLocaleString()} (~${(sessionInitialChunkTokens / 1000).toFixed(1)}k)`);
              console.log(`   • Purpose: User data context, sales scripts, prospect info`);
              console.log(`   • Expected: Should be CACHED after first turn`);
              
              console.log(`\n📊 Actual Gemini Reporting:`);
              console.log(`   • Fresh Text Input: ${totalInputTokens.toLocaleString()} tokens`);
              console.log(`   • Cached Tokens: ${totalCachedTokens.toLocaleString()} tokens`);
              console.log(`   • Total Input: ${(totalInputTokens + totalCachedTokens).toLocaleString()} tokens`);
              
              console.log(`\n🎯 ANALYSIS:`);
              if (totalCachedTokens === 0) {
                console.log(`   ❌ WARNING: NO CACHING DETECTED!`);
                console.log(`   • Initial chunks (${sessionInitialChunkTokens.toLocaleString()} tokens) are being counted as FRESH every turn`);
                console.log(`   • This means we're paying $0.50/1M instead of $0.03/1M (94% more expensive!)`);
                console.log(`   • Expected cached: ~${sessionInitialChunkTokens.toLocaleString()} tokens`);
                console.log(`   • Actual cached: 0 tokens`);
                console.log(`   • Discrepancy: ${sessionInitialChunkTokens.toLocaleString()} tokens NOT cached`);
              } else {
                const cacheEfficiency = (totalCachedTokens / sessionInitialChunkTokens) * 100;
                if (cacheEfficiency >= 90) {
                  console.log(`   ✅ EXCELLENT: Cache is working perfectly!`);
                  console.log(`   • ${cacheEfficiency.toFixed(1)}% of initial chunks are being cached`);
                  console.log(`   • Saving ~$${cacheSavings.toFixed(6)} per session`);
                } else if (cacheEfficiency >= 50) {
                  console.log(`   ⚠️  PARTIAL: Cache is working but not optimal`);
                  console.log(`   • Only ${cacheEfficiency.toFixed(1)}% of initial chunks are cached`);
                  console.log(`   • Expected: ~${sessionInitialChunkTokens.toLocaleString()} cached`);
                  console.log(`   • Actual: ${totalCachedTokens.toLocaleString()} cached`);
                  console.log(`   • Missing: ${(sessionInitialChunkTokens - totalCachedTokens).toLocaleString()} tokens not cached`);
                } else {
                  console.log(`   ❌ POOR: Cache efficiency is very low!`);
                  console.log(`   • Only ${cacheEfficiency.toFixed(1)}% of initial chunks are cached`);
                  console.log(`   • Majority of chunks being reprocessed as fresh every turn`);
                }
                
                // Check if fresh text input seems abnormally high
                const freshPerTurn = totalInputTokens; // Approximate
                if (freshPerTurn > sessionInitialChunkTokens * 0.5) {
                  console.log(`\n   🚨 ISSUE DETECTED:`);
                  console.log(`   • Fresh text input (${totalInputTokens.toLocaleString()}) is suspiciously high`);
                  console.log(`   • This suggests chunks might be re-sent or not cached properly`);
                  console.log(`   • Check if conversation history or system messages are growing`);
                }
              }
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            }
            
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 💾 DATABASE TRACKING - Save this API call to vertex_ai_usage_tracking
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            try {
              await db.insert(vertexAiUsageTracking).values({
                consultantId: consultantId,
                sessionId: connectionId, // Use WebSocket connectionId as session grouping
                callType: 'live_api',
                modelName: 'gemini-2.5-flash', // Current Live API model
                
                // Token counts
                promptTokens: inputTokens,
                candidatesTokens: outputTokens,
                cachedContentTokenCount: cachedTokens,
                
                // Audio metrics
                audioInputSeconds: audioInputSeconds,
                audioOutputSeconds: audioOutputSeconds,
                
                // Accurate cost breakdown
                textInputCost: textInputCost,
                audioInputCost: audioInputCost,
                audioOutputCost: audioOutputCost,
                cachedInputCost: cachedCost,
                totalCost: turnCost,
                
                // Store full metadata for analysis
                requestMetadata: {
                  usageMetadata: usage,
                  serverContent: response.serverContent ? {
                    hasAudio: !!response.serverContent.modelTurn?.parts?.some((p: any) => p.inlineData),
                    hasText: !!response.serverContent.modelTurn?.parts?.some((p: any) => p.text),
                  } : null,
                  endOfTurn: !!response.serverContent?.turnComplete,
                }
              });
              
              // Log database save (minimal - once per turn)
              console.log(`💾 [${connectionId}] Usage tracked → DB saved (Turn cost: $${turnCost.toFixed(6)})`);
              
            } catch (dbError: any) {
              console.error(`❌ [${connectionId}] Failed to save usage tracking to database:`, dbError.message);
              // Don't block the flow - tracking is auxiliary
            }
          }

          // Audio output da Gemini
          if (response.serverContent?.modelTurn?.parts) {
            // 🆕 WATCHDOG: Gemini sta rispondendo - cancella il timer!
            if (userMessagePendingResponse) {
              cancelResponseWatchdog();
            }
            
            for (const part of response.serverContent.modelTurn.parts) {
              // 🛑 BARGE-IN: Check interruption flag in each part
              if (part.interrupted) {
                const interruptTimestamp = new Date().toISOString();
                const partType = part.inlineData ? 'audio' : part.text ? 'text' : 'unknown';
                const partSize = part.inlineData?.data ? part.inlineData.data.length : 0;
                
                console.log(`\n🛑 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`🛑 [${connectionId}] BARGE-IN DETECTED - Gemini VAD triggered interruption`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`⏰ Timestamp: ${interruptTimestamp}`);
                console.log(`📊 Part type: ${partType}`);
                if (partSize > 0) {
                  console.log(`📏 Part size: ${partSize} bytes (base64 encoded audio)`);
                }
                console.log(`🎤 AI was speaking: ${isAiSpeaking ? 'YES' : 'NO'}`);
                console.log(`🎯 VAD Config: MEDIUM sensitivity, 400ms prefix, 700ms silence`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                
                // 🔒 Reset AI speaking state immediately
                if (isAiSpeaking) {
                  isAiSpeaking = false;
                  console.log(`🔇 [${connectionId}] AI stopped speaking (user barge-in)`);
                }
                
                // Invia messaggio al client per fermare audio immediato
                clientWs.send(JSON.stringify({
                  type: 'barge_in_detected',
                  message: 'User interrupted - stop audio playback immediately'
                }));
                
                // Skip processing this part - it was interrupted
                continue;
              }
              
              if (part.inlineData?.data) {
                // Log ridotto - solo primo chunk o ogni 30 secondi
                // (non logghiamo ogni singolo chunk)
                
                // ❌ DISABILITATO: Il blocco prospectHasSpoken causava problemi di interazione
                // L'AI non poteva parlare anche quando l'utente era in attesa
                // TODO: Risolvere il problema con un approccio diverso (prompt-based invece di blocco audio)
                
                // 🔒 Track AI speaking (audio streaming) - MANTIENI true su OGNI chunk
                if (!isAiSpeaking) {
                  isAiSpeaking = true;
                  console.log(`🎤 [${connectionId}] AI started speaking (audio streaming)`);
                } else {
                  // Assicurati che rimanga true durante tutto lo streaming
                  isAiSpeaking = true;
                }
                
                // PCM 24kHz raw da Gemini - converti in WAV per il browser
                const pcmBuffer = base64ToBuffer(part.inlineData.data);
                const wavBuffer = await convertPCMToWAV(pcmBuffer, 24000);
                
                clientWs.send(JSON.stringify({
                  type: 'audio_output',
                  data: bufferToBase64(wavBuffer)
                }));
              }

              if (part.text) {
                console.log(`💬 [${connectionId}] AI transcript: ${part.text}`);
                
                // Accumula anche i text parts per tracciamento server-side
                currentAiTranscript += part.text;
                
                // 🔒 Check for greetings if we're in closing flow
                if (closingState === 'waiting_saluto' || closingState === 'waiting_ai_finish') {
                  if (containsGreeting(part.text)) {
                    console.log(`👋 [${connectionId}] GREETING DETECTED: "${part.text}"`);
                    // Don't close yet - wait for turn_complete to ensure full message is sent
                    // Just mark that we found the greeting
                  }
                }
                
                clientWs.send(JSON.stringify({
                  type: 'ai_transcript',
                  text: part.text
                }));
              }
            }
          }

          // Output transcription (audio → text) - arriva in tempo reale mentre AI parla
          if (response.serverContent?.outputTranscription?.text) {
            const transcriptText = response.serverContent.outputTranscription.text;
            console.log(`📝 [${connectionId}] AI transcript (output): ${transcriptText}`);
            
            // Accumula per tracciamento server-side
            currentAiTranscript += transcriptText;
            
            // 🔒 Check for greetings if we're in closing flow
            if (closingState === 'waiting_saluto' || closingState === 'waiting_ai_finish') {
              if (containsGreeting(transcriptText)) {
                console.log(`👋 [${connectionId}] GREETING DETECTED in output transcript: "${transcriptText}"`);
              }
            }
            
            clientWs.send(JSON.stringify({
              type: 'ai_transcript',
              text: transcriptText
            }));
          }

          // Input transcription (user audio → text) - arriva in tempo reale mentre l'utente parla
          if (response.serverContent?.inputTranscription?.text) {
            const userTranscriptText = response.serverContent.inputTranscription.text;
            const isFinal = response.serverContent.inputTranscription.isFinal || false;
            
            // 🇮🇹 LANGUAGE FILTER: Scarta transcript con caratteri non validi o lingue sbagliate
            const hasInvalidChars = userTranscriptText.includes('??') || userTranscriptText.includes('�');
            const hasOnlyNonItalianChars = /^[^a-zA-Z\u00C0-\u00FF\u0100-\u017F\s.,!?'-]+$/.test(userTranscriptText);
            
            // Calculate ratio of non-Latin characters (indicates wrong language/encoding)
            // 🔧 FIX: Remove common symbols before calculating ratio (€, $, £, %, etc. were causing false positives)
            const textForAnalysis = userTranscriptText.replace(/[€$£%@#&*()+=\[\]{}|\\:;"'<>,.?\/!\-0-9]/g, '');
            const totalChars = textForAnalysis.replace(/\s/g, '').length;
            const latinChars = (textForAnalysis.match(/[a-zA-Z\u00C0-\u00FF\u0100-\u017F]/g) || []).length;
            const nonLatinRatio = totalChars > 0 ? 1 - (latinChars / totalChars) : 0;
            
            // Check for common Spanish/French words (heuristic for wrong language detection)
            const spanishFrenchWords = ['señor', 'señora', 'gracias', 'por favor', 'bonjour', 'merci', 'monsieur', 'madame'];
            const lowerText = userTranscriptText.toLowerCase();
            const hasWrongLanguageWords = spanishFrenchWords.some(word => lowerText.includes(word));
            
            const shouldFilter = hasInvalidChars || hasOnlyNonItalianChars || nonLatinRatio > 0.3 || hasWrongLanguageWords;
            
            if (shouldFilter && userTranscriptText.trim().length > 0) {
              console.warn(`⚠️ [${connectionId}] LANGUAGE FILTER: Scartato transcript non italiano: "${userTranscriptText}"`);
              if (hasInvalidChars) {
                console.warn(`   → Motivo: Caratteri non riconosciuti (?? o �)`);
              }
              if (hasOnlyNonItalianChars) {
                console.warn(`   → Motivo: Solo caratteri non-latini`);
              }
              if (nonLatinRatio > 0.3) {
                console.warn(`   → Motivo: Troppi caratteri non-latini (${Math.round(nonLatinRatio * 100)}%)`);
              }
              if (hasWrongLanguageWords) {
                console.warn(`   → Motivo: Rilevate parole spagnole/francesi`);
              }
              console.warn(`   → Transcript ignorato, attendo prossimo chunk`);
              // Skip processing - don't update transcript or send to client
            } else {
              // 🆕 TASK 7: Prospect ha parlato per primo! Abilita audio AI
              if (!prospectHasSpoken) {
                prospectHasSpoken = true;
                console.log(`\n✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`✅ [${connectionId}] PROSPECT SPOKE FIRST! Enabling AI audio output`);
                console.log(`   → Transcript: "${userTranscriptText}"`);
                console.log(`   → Dropped ${aiOutputBuffered} audio chunks while waiting`);
                console.log(`   → AI can now speak freely`);
                console.log(`✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                aiOutputBuffered = 0; // Reset counter
              }
              
              // 🔧 VAD CONCATENATION FIX: Handle both cumulative AND fragmented speech
              // Problem: Sometimes Gemini sends cumulative ("Ciao" → "Ciao come")
              //          but sometimes sends fragments ("Mol" → "to male.")
              // Solution: Detect if new chunk is continuation and concatenate appropriately
              const now = Date.now();
              const timeSinceLastChunk = now - vadLastChunkTime;
              
              // Reset buffer if too much time has passed (new utterance)
              if (timeSinceLastChunk > VAD_CONCAT_TIMEOUT_MS) {
                vadConcatBuffer = '';
              }
              
              // Determine if chunk is cumulative or fragmented
              let processedTranscript = userTranscriptText;
              
              if (vadConcatBuffer.length > 0) {
                // Robust cumulative detection: ONLY use startsWith to avoid false positives
                // Example: "Ciao" → "Ciao come stai" is cumulative (new starts with old)
                // Example: "Mol" → "to male." is fragmented (new does NOT start with old)
                const bufferLower = vadConcatBuffer.toLowerCase().trim();
                const chunkLower = userTranscriptText.toLowerCase().trim();
                
                // ONLY cumulative if new chunk starts with buffer content
                // Removed: includes() check which caused "come stai ciao" to overwrite "ciao"
                const isCumulative = bufferLower.length > 0 && chunkLower.startsWith(bufferLower);
                
                if (isCumulative) {
                  // Cumulative: new chunk extends buffer, use new chunk (it's longer/complete)
                  processedTranscript = userTranscriptText;
                  console.log(`📝 [VAD CONCAT] Cumulative (extends buffer): "${processedTranscript}"`);
                } else {
                  // Fragmented: new chunk is separate, need to concatenate
                  // Check if this looks like a split word vs new sentence
                  const lastCharOfBuffer = vadConcatBuffer.slice(-1);
                  const firstCharOfChunk = userTranscriptText.charAt(0);
                  
                  // Check for sentence-ending punctuation - these should ALWAYS get a space
                  const bufferEndsSentence = /[.!?;:]$/.test(vadConcatBuffer.trim());
                  
                  // Join WITHOUT space only if:
                  // - Buffer does NOT end with sentence punctuation
                  // - Buffer ends with a letter (partial word)
                  // - Chunk starts with lowercase letter (continuation of word)
                  const isPartialWord = !bufferEndsSentence && 
                                        /[a-z]$/i.test(lastCharOfBuffer) && 
                                        /^[a-z]/.test(firstCharOfChunk); // lowercase only = continuation
                  
                  if (isPartialWord) {
                    // Likely a split word like "Mol" + "to" -> "Molto"
                    processedTranscript = vadConcatBuffer + userTranscriptText;
                    console.log(`📝 [VAD CONCAT] Word fragment: "${vadConcatBuffer}" + "${userTranscriptText}" = "${processedTranscript}"`);
                  } else {
                    // New sentence or separate word - add space
                    const needsSpace = !vadConcatBuffer.endsWith(' ') && !userTranscriptText.startsWith(' ');
                    processedTranscript = vadConcatBuffer + (needsSpace ? ' ' : '') + userTranscriptText;
                    console.log(`📝 [VAD CONCAT] New phrase: "${vadConcatBuffer}" + "${userTranscriptText}" = "${processedTranscript}"`);
                  }
                }
              }
              
              // Update buffer and timestamp
              vadConcatBuffer = processedTranscript;
              vadLastChunkTime = now;
              
              currentUserTranscript = processedTranscript;
              
              // 🎯 SALES SCRIPT TRACKING - Buffer user transcript until isFinal
              pendingUserTranscript.text = processedTranscript;
              
              if (isFinal) {
                pendingUserTranscript.hasFinalChunk = true;
                const finalTranscript = processedTranscript; // Use concatenated version
                
                // Reset VAD buffer on final
                vadConcatBuffer = '';
                vadLastChunkTime = 0;
                
                // 🔧 FIX: Use try/finally to ensure both commit AND reset happen
                // even if salesTracker throws an error
                try {
                  // Track with salesTracker if available
                  if (salesTracker && salesLogger) {
                    try {
                      await salesTracker.trackUserMessage(finalTranscript);
                      const state = salesTracker.getState();
                      salesLogger.logUserMessage(finalTranscript, state.currentPhase);
                      
                      // Check if response was vague (ladder continuation logic)
                      const lastLadder = state.ladderActivations[state.ladderActivations.length - 1];
                      if (lastLadder && salesLogger) {
                        salesLogger.logLadderResponse(lastLadder.wasVague, lastLadder.wasVague);
                      }
                      
                      // 🤖➡️😊 CONTEXTUAL RESPONSE DETECTION: Check if user is asking a question
                      if (isProspectQuestion(finalTranscript)) {
                        lastProspectQuestion = finalTranscript;
                        console.log(`🤖➡️😊 [${connectionId}] PROSPECT QUESTION DETECTED: "${finalTranscript.substring(0, 80)}..."`);
                        console.log(`   → AI should respond to this before continuing script (Anti-Robot Mode)`);
                      }
                    } catch (trackError: any) {
                      console.error(`❌ [${connectionId}] Sales tracking error (user isFinal):`, trackError.message);
                    }
                  }
                } finally {
                  // 🔧 FIX: Always commit user message to conversationMessages and reset buffer
                  // This runs AFTER salesTracker, ensuring no duplicates from fallback path
                  
                  // 🆕 PIGGYBACK STRATEGY (Trojan Horse): Inject combined message to Gemini
                  // We send the feedback as a TEXT message AFTER user's audio is processed
                  // This works because Gemini Live API uses turnComplete:false to add context
                  // before generating a response
                  if (pendingFeedbackForAI && geminiSession) {
                    console.log(`\n📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📤 [${connectionId}] PIGGYBACK INJECTION - Sending feedback to Gemini`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`   👤 User said: "${finalTranscript.substring(0, 80)}${finalTranscript.length > 80 ? '...' : ''}"`);
                    console.log(`   📝 Injecting: "${pendingFeedbackForAI.substring(0, 100)}..."`);
                    console.log(`   🎯 Strategy: Inject AFTER audio, BEFORE response (Trojan Horse)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                    
                    // Send feedback to Gemini with turnComplete:false (adds context, doesn't trigger response)
                    const feedbackPayload = {
                      clientContent: {
                        turns: [{
                          role: 'user',
                          parts: [{ text: pendingFeedbackForAI }]
                        }],
                        turnComplete: false // CRITICAL: Don't trigger response, just add context
                      }
                    };
                    geminiSession.send(JSON.stringify(feedbackPayload));
                    
                    // Save combined message in local history (user msg + feedback)
                    const combinedMessage = finalTranscript + '\n\n' + pendingFeedbackForAI;
                    commitUserMessage(combinedMessage);
                    
                    // Clear feedback from RAM buffer
                    const usedFeedback = pendingFeedbackForAI; // Save before clearing for logging
                    pendingFeedbackForAI = null;
                    
                    // 🆕 Clear feedback from DB as well (consumed)
                    if (conversationId) {
                      db.update(clientSalesConversations)
                        .set({ pendingFeedback: null, pendingFeedbackCreatedAt: null })
                        .where(eq(clientSalesConversations.id, conversationId))
                        .then(() => console.log(`   💾 Feedback cleared from DB after injection`))
                        .catch((err: any) => console.error(`   ⚠️ Failed to clear feedback from DB: ${err.message}`));
                    }
                  } else {
                    // No feedback pending - just commit the user message
                    commitUserMessage(finalTranscript);
                  }
                  
                  pendingUserTranscript = { text: '', hasFinalChunk: false };
                  
                  // 🆕 WATCHDOG: Avvia il timer - Gemini deve rispondere entro 2 secondi
                  if (geminiSession) {
                    startResponseWatchdog(finalTranscript, geminiSession);
                  }
                }
              }
              
              // 🎯 VAD DEBUG: Log evidenziato per capire quando Gemini VAD rileva l'inizio del parlato
              console.log(`\n🚨 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🎤 [VAD DETECTION] Gemini rilevato parlato utente!`);
              console.log(`   → Testo rilevato: "${userTranscriptText}"`);
              console.log(`   → Timestamp: ${new Date().toISOString()}`);
              console.log(`   → AI sta parlando? ${isAiSpeaking ? 'SÌ - INTERROMPO AUDIO!' : 'No'}`);
              console.log(`🚨 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // 🔥 BARGE-IN FIX: Se AI sta parlando, FERMA IMMEDIATAMENTE l'audio client-side
              if (isAiSpeaking) {
                console.log(`🛑 [${connectionId}] BARGE-IN ATTIVATO - Invio stop_audio al client`);
                clientWs.send(JSON.stringify({
                  type: 'stop_audio',
                  reason: 'user_speaking',
                  message: 'User is speaking - stop AI audio immediately'
                }));
                
                // Reset flag - l'AI è stato interrotto
                isAiSpeaking = false;
              }
              
              // Invia al client la trascrizione dell'utente in tempo reale
              clientWs.send(JSON.stringify({
                type: 'user_transcript',
                text: userTranscriptText
              }));
            }
          }

          // Turn complete - salva il messaggio AI completo
          if (response.serverContent?.turnComplete) {
            console.log(`✅ [${connectionId}] Turn complete`);
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🎯 SALES SCRIPT TRACKING - Fallback: Track user message if no isFinal received
            // (Most cases: user message already tracked when isFinal arrived)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            if (pendingUserTranscript.text.trim() && !pendingUserTranscript.hasFinalChunk) {
              const trimmedUserTranscript = pendingUserTranscript.text.trim();
              
              // 🔧 FIX: Commit user message even if salesTracker is not active
              commitUserMessage(trimmedUserTranscript);
              console.log(`⚠️  [${connectionId}] Sales tracking: Fallback - committed user message without isFinal flag`);
              
              // Track with salesTracker if available
              if (salesTracker && salesLogger) {
                try {
                  await salesTracker.trackUserMessage(trimmedUserTranscript);
                  const state = salesTracker.getState();
                  salesLogger.logUserMessage(trimmedUserTranscript, state.currentPhase);
                } catch (trackError: any) {
                  console.error(`❌ [${connectionId}] Sales tracking error (user fallback):`, trackError.message);
                }
              }
              
              pendingUserTranscript = { text: '', hasFinalChunk: false }; // Reset
            }
            
            // 🔒 AI has finished speaking
            const wasAiSpeaking = isAiSpeaking;
            isAiSpeaking = false;
            if (wasAiSpeaking) {
              console.log(`🔇 [${connectionId}] AI finished speaking (turn complete)`);
            }
            
            // 🔒 Check closing state machine
            if (closingState === 'waiting_ai_finish') {
              // AI ha finito di parlare, ora aspetta il saluto
              const fullTranscript = currentAiTranscript.trim();
              if (containsGreeting(fullTranscript)) {
                console.log(`✅ [${connectionId}] Closing state: waiting_ai_finish → ready_to_close (greeting found)`);
                closingState = 'ready_to_close';
              } else {
                console.log(`⏳ [${connectionId}] Closing state: waiting_ai_finish → waiting_saluto (no greeting yet)`);
                closingState = 'waiting_saluto';
              }
            } else if (closingState === 'waiting_saluto') {
              // Stava aspettando il saluto, controlla se c'è
              const fullTranscript = currentAiTranscript.trim();
              if (containsGreeting(fullTranscript)) {
                console.log(`✅ [${connectionId}] Closing state: waiting_saluto → ready_to_close (greeting found)`);
                closingState = 'ready_to_close';
              }
            }
            
            // Salva il messaggio AI completo se ha trascritto qualcosa
            if (currentAiTranscript.trim()) {
              const trimmedTranscript = currentAiTranscript.trim();
              
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // 🆕 LOOP DETECTION: Controlla se l'AI sta ripetendo la stessa risposta
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              const lastResponse = lastAiResponses[lastAiResponses.length - 1];
              if (lastResponse) {
                const similarity = calculateTextSimilarity(trimmedTranscript, lastResponse);
                
                if (similarity > SIMILARITY_THRESHOLD) {
                  consecutiveLoopCount++;
                  isLooping = true;
                  
                  console.log(`\n🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  console.log(`🔴 [${connectionId}] LOOP DETECTED! AI sta ripetendo la stessa risposta!`);
                  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  console.log(`   📊 Similarità: ${(similarity * 100).toFixed(0)}% (soglia: ${SIMILARITY_THRESHOLD * 100}%)`);
                  console.log(`   🔢 Conteggio consecutivo: ${consecutiveLoopCount}`);
                  console.log(`   📝 Risposta attuale: "${trimmedTranscript.substring(0, 60)}..."`);
                  console.log(`   📝 Risposta precedente: "${lastResponse.substring(0, 60)}..."`);
                  
                  // 🆕 AZIONE 1: Se loop rilevato 2+ volte, prepara feedback CRITICO
                  if (consecutiveLoopCount >= 2) {
                    const loopFeedback = `
⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ ATTENZIONE CRITICA - STAI RIPETENDO LA STESSA DOMANDA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ Il prospect ha GIÀ RISPOSTO a questa domanda.
❌ NON ripetere MAI la stessa frase!
🔴 DEVI fare una domanda COMPLETAMENTE DIVERSA!
📍 Passa SUBITO al prossimo step dello script.
🚫 NON dire più: "${lastResponse.substring(0, 50)}..."
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
                    // Prepend al feedback esistente o crea nuovo
                    if (pendingFeedbackForAI) {
                      pendingFeedbackForAI = loopFeedback + '\n\n' + pendingFeedbackForAI;
                    } else {
                      pendingFeedbackForAI = loopFeedback;
                    }
                    console.log(`   📤 Feedback CRITICO anti-loop preparato per injection`);
                  }
                  
                  // 🆕 AZIONE 2: Se loop 3+ volte, FORZA avanzamento step
                  if (consecutiveLoopCount >= 3 && salesTracker) {
                    console.log(`   🔴 LOOP CRITICO (${consecutiveLoopCount}x) - Tentativo FORCE ADVANCE!`);
                    try {
                      const advanced = salesTracker.forceAdvanceToNextStep();
                      if (advanced) {
                        console.log(`   ✅ Step avanzato forzatamente per uscire dal loop`);
                      } else {
                        console.log(`   ⚠️ Impossibile avanzare - già all'ultimo step`);
                      }
                    } catch (forceErr: any) {
                      console.log(`   ❌ Errore force advance: ${forceErr.message}`);
                    }
                  }
                  
                  console.log(`🔴 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                } else {
                  // Non è un loop - reset contatore
                  if (consecutiveLoopCount > 0) {
                    console.log(`✅ [${connectionId}] LOOP RESET - Risposta diversa (similarità: ${(similarity * 100).toFixed(0)}%)`);
                  }
                  consecutiveLoopCount = 0;
                  isLooping = false;
                }
              }
              
              // Aggiorna array risposte (FIFO)
              lastAiResponses.push(trimmedTranscript);
              if (lastAiResponses.length > MAX_TRACKED_RESPONSES) {
                lastAiResponses.shift();
              }
              
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // ✅ QUALITY VALIDATION: Check AI message for common issues
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              const questionCount = (trimmedTranscript.match(/\?/g) || []).length;
              const messageLength = trimmedTranscript.length;
              const hasPlaceholder = /\[\.\.\.]/g.test(trimmedTranscript) || 
                                    /\[PROBLEMA]/g.test(trimmedTranscript) ||
                                    /\[STATO ATTUALE]/g.test(trimmedTranscript) ||
                                    /\$prospectName/g.test(trimmedTranscript);
              
              // Log validation results (only log warnings when there are actual issues)
              if (questionCount > 1 || messageLength > 500 || hasPlaceholder) {
                console.log(`\n⚠️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${connectionId}] AI MESSAGE QUALITY WARNING`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                if (questionCount > 1) {
                  console.log(`   🚨 MULTIPLE QUESTIONS: ${questionCount} questions detected (should ask ONE at a time)`);
                }
                if (messageLength > 500) {
                  console.log(`   📏 TOO LONG: ${messageLength} chars (may be reading script robotically)`);
                }
                if (hasPlaceholder) {
                  console.log(`   🔧 PLACEHOLDER: Unsubstituted placeholder detected`);
                }
                console.log(`   📝 Message: "${trimmedTranscript.substring(0, 150)}${trimmedTranscript.length > 150 ? '...' : ''}"`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              }
              
              conversationMessages.push({
                role: 'assistant',
                transcript: trimmedTranscript,
                duration: 0, // Calcolato dal client
                timestamp: new Date().toISOString()
              });
              console.log(`💾 [${connectionId}] Saved AI message (server-side): ${conversationMessages.length} total messages`);
              
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // 🎯 SALES SCRIPT TRACKING - Track AI message
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              if (salesTracker && salesLogger) {
                try {
                  await salesTracker.trackAIMessage(trimmedTranscript);
                  const state = salesTracker.getState();
                  salesLogger.logAIMessage(trimmedTranscript, state.currentPhase);
                  
                  // 🤖➡️😊 CONTEXTUAL RESPONSE TRACKING: Check if AI responded to prospect's question
                  if (lastProspectQuestion) {
                    // AI is responding after a question - this is contextual response (Anti-Robot Mode)
                    await salesTracker.addContextualResponse(lastProspectQuestion, trimmedTranscript);
                    console.log(`✅ [${connectionId}] CONTEXTUAL RESPONSE tracked - AI answered prospect's question before continuing script`);
                    lastProspectQuestion = null; // Reset
                  }
                  
                  // 🎯 STEP ADVANCEMENT AGENT: Analyze conversation and advance step if needed
                  // Runs in background (~300ms) after each AI turn - doesn't block conversation flow
                  // 🔒 MUTEX: Skip if another analysis is already in progress (prevent race conditions)
                  console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  console.log(`🔍 [${connectionId}] STEP ADVANCEMENT CHECK`);
                  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                  console.log(`   📋 trackerClientId: ${trackerClientId || 'NULL'}`);
                  console.log(`   📋 trackerConsultantId: ${trackerConsultantId || 'NULL'}`);
                  console.log(`   🔒 isAdvancementInProgress: ${isAdvancementInProgress}`);
                  
                  if (trackerClientId && trackerConsultantId && !isAdvancementInProgress) {
                    console.log(`   ✅ PROCEEDING with Sales Manager Agent call...`);
                    isAdvancementInProgress = true; // Acquire lock
                    // Fire and forget - don't await to avoid blocking
                    (async () => {
                      try {
                        const script = salesTracker.getScriptStructure();
                        const state = salesTracker.getState();
                        const { phaseIndex, stepIndex } = salesTracker.getCurrentIndices();
                        
                        console.log(`\n🚀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`🚀 [${connectionId}] STEP ADVANCEMENT AGENT - STARTING ANALYSIS`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`   📍 Current Phase: ${state.currentPhase}`);
                        console.log(`   📍 Current Step: ${state.currentStep || 'N/A'}`);
                        console.log(`   📍 Phase Index: ${phaseIndex}, Step Index: ${stepIndex}`);
                        console.log(`   📜 Script has ${script.phases.length} phases`);
                        console.log(`   💬 Conversation has ${conversationMessages.length} messages`);
                        
                        // Prepare recent messages from conversationMessages
                        const recentMessages = conversationMessages.slice(-6).map(msg => ({
                          role: msg.role as 'user' | 'assistant',
                          content: msg.transcript,
                          timestamp: msg.timestamp
                        }));
                        
                        // 🔍 DEBUG: Log esatto dei messaggi passati al SalesManagerAgent
                        console.log(`\n📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`📋 [${connectionId}] MESSAGGI PASSATI AL SALES MANAGER (${recentMessages.length}):`);
                        recentMessages.forEach((msg, i) => {
                          const preview = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
                          console.log(`   ${i+1}. [${msg.role.toUpperCase()}]: "${preview}"`);
                        });
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        
                        // Prepare script structure for agent
                        const scriptForAgent = {
                          phases: script.phases.map(p => ({
                            id: p.id,
                            number: p.number,
                            name: p.name,
                            description: p.description,
                            steps: p.steps.map(s => ({
                              id: s.id,
                              number: s.number,
                              name: s.name,
                              objective: s.objective,
                              questions: s.questions || []
                            }))
                          }))
                        };
                        
                        // 🆕 Get current phase energy for tone reminder
                        const currentPhase = script.phases.find(p => p.id === state.currentPhase);
                        const currentPhaseEnergy = currentPhase?.energy ? {
                          level: currentPhase.energy.level || 'MEDIO',
                          tone: currentPhase.energy.tone || 'SICURO',
                          pace: currentPhase.energy.pace || 'MODERATO'
                        } : undefined;
                        
                        // 🆕 Use pre-saved business context for feedback
                        const businessContext = agentBusinessContext;
                        
                        const params: SalesManagerParams = {
                          recentMessages,
                          script: scriptForAgent,
                          currentPhaseId: state.currentPhase,
                          currentStepId: state.currentStep,
                          currentPhaseIndex: phaseIndex,
                          currentStepIndex: stepIndex,
                          clientId: trackerClientId,
                          consultantId: trackerConsultantId,
                          currentPhaseEnergy,
                          businessContext, // 🆕 Per rilevamento fuori scope
                          totalMessages: conversationMessages.length
                        };
                        
                        // 🆕 LOG ALWAYS-VISIBLE: Business context at analysis time
                        console.log(`\n👤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`👤 BUSINESS CONTEXT AVAILABLE FOR FEEDBACK:`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        if (businessContext) {
                          console.log(`   🏢 Name: ${businessContext.businessName || 'N/A'}`);
                          console.log(`   🎯 What we do: ${businessContext.whatWeDo ? businessContext.whatWeDo.substring(0, 100) : 'N/A'}${businessContext.whatWeDo && businessContext.whatWeDo.length > 100 ? '...' : ''}`);
                          console.log(`   👥 Target client: ${businessContext.targetClient ? businessContext.targetClient.substring(0, 80) : 'N/A'}${businessContext.targetClient && businessContext.targetClient.length > 80 ? '...' : ''}`);
                          console.log(`   🚫 Non-target: ${businessContext.nonTargetClient ? businessContext.nonTargetClient.substring(0, 80) : 'N/A'}${businessContext.nonTargetClient && businessContext.nonTargetClient.length > 80 ? '...' : ''}`);
                          console.log(`   📋 Services: ${businessContext.servicesOffered?.slice(0, 3).join(', ') || 'N/A'}`);
                        } else {
                          console.log(`   ⚠️  NO business context available - feedback will lack business identity`);
                        }
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        
                        console.log(`   📨 Calling SalesManagerAgent.analyze()...`);
                        const analysisStart = Date.now();
                        const analysis: SalesManagerAnalysis = await SalesManagerAgent.analyze(params);
                        const analysisTime = Date.now() - analysisStart;
                        
                        // Extract step advancement from full analysis
                        const stepResult = analysis.stepAdvancement;
                        
                        console.log(`\n📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`📊 [${connectionId}] SALES MANAGER AGENT - RESULT (${analysisTime}ms)`);
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`   🎯 shouldAdvance: ${stepResult.shouldAdvance}`);
                        console.log(`   📍 nextPhaseId: ${stepResult.nextPhaseId || 'null'}`);
                        console.log(`   📍 nextStepId: ${stepResult.nextStepId || 'null'}`);
                        console.log(`   📈 confidence: ${(stepResult.confidence * 100).toFixed(0)}%`);
                        console.log(`   💡 reasoning: ${stepResult.reasoning}`);
                        if (analysis.buySignals.detected) {
                          console.log(`   💰 BUY SIGNALS: ${analysis.buySignals.signals.map(s => s.type).join(', ')}`);
                        }
                        if (analysis.objections.detected) {
                          console.log(`   🛡️ OBJECTIONS: ${analysis.objections.objections.map(o => o.type).join(', ')}`);
                        }
                        if (analysis.toneAnalysis.issues.length > 0) {
                          console.log(`   🎭 TONE ISSUES: ${analysis.toneAnalysis.issues.join(', ')}`);
                        }
                        if (analysis.feedbackForAgent?.shouldInject) {
                          console.log(`   🔧 FEEDBACK (${analysis.feedbackForAgent.type}): ${analysis.feedbackForAgent.message.substring(0, 100)}...`);
                        }
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        
                        // 🆕 FEEDBACK INJECTION - SEMPRE invia il tag quando c'è reasoning disponibile
                        // 🔧 FIX CRITICO: Il reasoning del Manager deve essere SEMPRE incluso nel tag
                        // per garantire che l'agente abbia sempre il contesto del supervisore.
                        // Il tag viene inviato se:
                        // 1. C'è un feedback specifico (obiezioni, buy signals, etc.)
                        // 2. OPPURE c'è reasoning valido dal Manager (non solo messaggi di default)
                        const hasValidReasoning = stepResult.reasoning && 
                          stepResult.reasoning.length > 10 && 
                          !stepResult.reasoning.includes('Pending AI analysis') &&
                          !stepResult.reasoning.includes('Timeout') &&
                          !stepResult.reasoning.includes('Failed to parse');
                        
                        const shouldInjectInstruction = analysis.feedbackForAgent?.shouldInject || hasValidReasoning;
                        
                        // 🆕 Define phase/step info BEFORE if block - used both inside and outside
                        const totalPhases = scriptForAgent?.phases?.length || 1;
                        const currentPhaseNum = (phaseIndex >= 0 ? phaseIndex : 0) + 1;
                        const currentPhaseName = currentPhase?.name || state?.currentPhase || 'Fase corrente';
                        const currentStepName = currentPhase?.steps?.[stepIndex]?.name || state?.currentStep || 'Step corrente';
                        const currentObjective = currentPhase?.steps?.[stepIndex]?.objective || currentPhase?.description || 'Seguire lo script e ottenere le info necessarie';
                        
                        if (shouldInjectInstruction) {
                          const feedback = analysis.feedbackForAgent;
                          
                          // Determina cosa fa bene e cosa deve migliorare (le variabili di fase sono già definite sopra)
                          let doingWell = '';
                          let needsImprovement = '';
                          let statusMessage = '';
                          let whatYouNeed = '';
                          let feedbackType = 'reasoning'; // Default quando solo reasoning
                          let feedbackPriority = 'medium';
                          let toneReminder = '';
                          
                          // Analizza tipo di feedback per costruire messaggi appropriati
                          // 🆕 Gestisce anche il caso feedback === null (solo reasoning presente)
                          if (feedback?.type === 'objection') {
                            feedbackType = 'objection';
                            feedbackPriority = feedback.priority || 'high';
                            doingWell = 'Stai mantenendo la conversazione attiva';
                            needsImprovement = feedback.message;
                            statusMessage = 'Rimani in questa fase - gestisci prima l\'obiezione';
                            whatYouNeed = 'Rispondere all\'obiezione con empatia, poi tornare allo script';
                            toneReminder = feedback.toneReminder || '';
                          } else if (feedback?.type === 'buy_signal') {
                            feedbackType = 'buy_signal';
                            feedbackPriority = feedback.priority || 'high';
                            doingWell = 'Hai generato interesse - il prospect mostra segnali di acquisto!';
                            needsImprovement = 'Non perdere il momento - capitalizza subito';
                            statusMessage = feedback.message.includes('CLOSING') ? 'PROCEDI SUBITO verso il closing!' : 'Rimani e approfondisci l\'interesse';
                            whatYouNeed = feedback.message;
                            toneReminder = feedback.toneReminder || '';
                          } else if (feedback?.type === 'tone') {
                            feedbackType = 'tone';
                            feedbackPriority = feedback.priority || 'medium';
                            doingWell = 'Stai seguendo lo script';
                            needsImprovement = feedback.message;
                            statusMessage = 'Rimani in questa fase - correggi il tono prima';
                            whatYouNeed = feedback.toneReminder || 'Adegua energia e tono alla fase';
                            toneReminder = feedback.toneReminder || '';
                          } else if (feedback?.type === 'checkpoint') {
                            feedbackType = 'checkpoint';
                            feedbackPriority = feedback.priority || 'medium';
                            doingWell = 'Stai procedendo nella conversazione';
                            needsImprovement = feedback.message;
                            statusMessage = 'Rimani in questa fase - checkpoint incompleto';
                            whatYouNeed = 'Completa le verifiche del checkpoint prima di avanzare';
                            toneReminder = feedback.toneReminder || '';
                          } else if (feedback?.type === 'out_of_scope') {
                            feedbackType = 'out_of_scope';
                            feedbackPriority = feedback.priority || 'high';
                            doingWell = 'Stai mantenendo la conversazione';
                            needsImprovement = feedback.message;
                            statusMessage = 'Rimani in questa fase - guida verso i nostri servizi';
                            whatYouNeed = 'Riporta gentilmente la conversazione sui servizi che offriamo';
                            toneReminder = feedback.toneReminder || '';
                          } else {
                            // 🆕 CASO DEFAULT: Solo reasoning presente, nessun feedback specifico
                            feedbackType = feedback?.type || 'reasoning';
                            feedbackPriority = feedback?.priority || 'low';
                            doingWell = analysis.toneAnalysis.issues.length === 0 ? 'Tono e ritmo corretti' : 'Stai seguendo lo script';
                            needsImprovement = feedback?.message || 'Continua a seguire lo script';
                            statusMessage = stepResult.shouldAdvance ? 'PASSA ORA alla prossima fase - senza chiedere permesso!' : 'Rimani in questa fase';
                            whatYouNeed = stepResult.shouldAdvance ? 'Avanza immediatamente allo step successivo - NON chiedere conferma al prospect!' : 'Ottieni le info mancanti prima di avanzare';
                            toneReminder = feedback?.toneReminder || '';
                          }
                          
                          // 🆕 Costruisci sezione IDENTITÀ del business (sempre presente)
                          // Include: chi sei, cosa fai, chi aiuti, chi NON aiuti, servizi
                          const servicesList = businessContext?.servicesOffered?.length > 0 
                            ? businessContext.servicesOffered.slice(0, 5).join(', ')
                            : '';
                          
                          const businessIdentity = businessContext ? 
                            `👤 SEI: ${businessContext.businessName || 'Il consulente'}
🎯 COSA FAI: ${businessContext.whatWeDo || 'Offri servizi specializzati'}
👥 CHI AIUTI: ${businessContext.targetClient || 'Clienti interessati ai nostri servizi'}
🚫 CHI NON AIUTI: ${businessContext.nonTargetClient || ''}
${servicesList ? `📋 SERVIZI: ${servicesList}` : ''}` 
                            : '';
                          
                          // 🆕 Costruisci sezione ENERGIA/TONO (sempre presente, con fallback)
                          const phaseEnergy = currentPhaseEnergy || { level: 'MEDIO', tone: 'SICURO', pace: 'MODERATO' };
                          const energySection = `🔋 ENERGIA: ${phaseEnergy.level} | TONO: ${phaseEnergy.tone} | RITMO: ${phaseEnergy.pace}`;
                          
                          // 🆕 SEMPRE includere il reasoning del Manager quando disponibile
                          // Questo è CRITICO per garantire che l'agente abbia sempre il contesto
                          const managerReasoning = hasValidReasoning ? stepResult.reasoning : '';
                          
                          // Formato STRUTTURATO per il coaching con NUOVI DELIMITATORI (Trojan Horse Strategy)
                          // L'AI è istruita a riconoscere questi tag come "pensiero interno" e non leggerli ad alta voce
                          const feedbackContent = `<<<SALES_MANAGER_INSTRUCTION>>>
${businessIdentity}

📍 FASE: ${currentPhaseNum} di ${totalPhases} - ${currentPhaseName}
   STEP: ${currentStepName}
${energySection}

🎯 OBIETTIVO: ${currentObjective}
✅ FAI BENE: ${doingWell}
⚠️ MIGLIORA: ${needsImprovement}
🚦 STATO: ${statusMessage}
📋 TI SERVE: ${whatYouNeed}
${toneReminder ? `🎵 REMINDER TONO: ${toneReminder}` : ''}
${managerReasoning ? `\n💭 REASONING MANAGER: ${managerReasoning}` : ''}
<<</SALES_MANAGER_INSTRUCTION>>>`;
                          
                          // 🆕 IMMEDIATE INJECTION (Trojan Horse): Inject feedback NOW, not on next user message
                          // This ensures Gemini has the coaching context BEFORE the user speaks again
                          // Using turnComplete:false adds context without triggering a response
                          
                          console.log(`\n📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          console.log(`📤 [${connectionId}] IMMEDIATE FEEDBACK INJECTION (Trojan Horse)`);
                          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          console.log(`   📢 Priority: ${feedbackPriority.toUpperCase()}`);
                          console.log(`   📋 Type: ${feedbackType}`);
                          console.log(`   📝 Needs Improvement: ${needsImprovement.substring(0, 150)}${needsImprovement.length > 150 ? '...' : ''}`);
                          console.log(`   💭 Reasoning: ${managerReasoning ? managerReasoning.substring(0, 100) + '...' : 'N/A'}`);
                          console.log(`   🎵 Tone: ${toneReminder || 'N/A'}`);
                          console.log(`   🎯 Strategy: Inject NOW with turnComplete:false (before user speaks)`);
                          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          // 🆕 Log del feedbackContent COMPLETO per debug
                          console.log(`\n📋 FEEDBACK CONTENT COMPLETO:`);
                          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          console.log(feedbackContent);
                          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          
                          if (geminiSession) {
                            // Inject feedback immediately to Gemini
                            const feedbackPayload = {
                              clientContent: {
                                turns: [{
                                  role: 'user',
                                  parts: [{ text: feedbackContent }]
                                }],
                                turnComplete: false // CRITICAL: Don't trigger response, just add context
                              }
                            };
                            geminiSession.send(JSON.stringify(feedbackPayload));
                            console.log(`   ✅ Feedback SENT to Gemini with turnComplete:false`);
                            
                            // 🆕 PERSISTENZA DB: Save feedback for reconnection scenarios
                            // If WebSocket disconnects before user speaks, we need to re-inject on resume
                            if (conversationId) {
                              try {
                                await db.update(clientSalesConversations)
                                  .set({ 
                                    pendingFeedback: feedbackContent,
                                    pendingFeedbackCreatedAt: new Date()
                                  })
                                  .where(eq(clientSalesConversations.id, conversationId));
                                console.log(`   💾 Feedback also saved to DB (for reconnection backup)`);
                              } catch (dbError: any) {
                                console.error(`   ⚠️ Failed to save feedback to DB: ${dbError.message}`);
                              }
                            }
                          } else {
                            // Fallback: If session not ready, buffer for later
                            pendingFeedbackForAI = feedbackContent;
                            console.log(`   ⚠️ Session not ready - feedback buffered for later injection`);
                            
                            // Save to DB as well
                            if (conversationId) {
                              try {
                                await db.update(clientSalesConversations)
                                  .set({ 
                                    pendingFeedback: feedbackContent,
                                    pendingFeedbackCreatedAt: new Date()
                                  })
                                  .where(eq(clientSalesConversations.id, conversationId));
                                console.log(`   💾 Feedback saved to DB for later injection`);
                              } catch (dbError: any) {
                                console.error(`   ⚠️ Failed to save feedback to DB: ${dbError.message}`);
                              }
                            }
                          }
                          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                          
                          await salesTracker.addReasoning('sales_manager_feedback', 
                            `SalesManager feedback INJECTED (${feedbackType}/${feedbackPriority}): ${needsImprovement}${managerReasoning ? ` | Reasoning: ${managerReasoning.substring(0, 100)}` : ''}${toneReminder ? ` | Tone: ${toneReminder}` : ''}`
                          );
                        }
                        
                        // 🆕 SEND SALES MANAGER ANALYSIS TO CLIENT FOR UI VISUALIZATION
                        // This enables the frontend to display the Manager's thought process
                        try {
                          const managerAnalysisPayload = {
                            type: 'sales_manager_analysis',
                            timestamp: new Date().toISOString(),
                            analysis: {
                              stepAdvancement: {
                                shouldAdvance: stepResult.shouldAdvance,
                                nextPhaseId: stepResult.nextPhaseId,
                                nextStepId: stepResult.nextStepId,
                                confidence: stepResult.confidence,
                                reasoning: stepResult.reasoning
                              },
                              checkpointStatus: analysis.checkpointStatus ? {
                                checkpointId: analysis.checkpointStatus.checkpointId,
                                checkpointName: analysis.checkpointStatus.checkpointName,
                                isComplete: analysis.checkpointStatus.isComplete,
                                completedItems: analysis.checkpointStatus.completedItems,
                                missingItems: analysis.checkpointStatus.missingItems,
                                canAdvance: analysis.checkpointStatus.canAdvance
                              } : null,
                              buySignals: {
                                detected: analysis.buySignals.detected,
                                signals: analysis.buySignals.signals.map(s => ({
                                  type: s.type,
                                  phrase: s.phrase,
                                  confidence: s.confidence
                                }))
                              },
                              objections: {
                                detected: analysis.objections.detected,
                                objections: analysis.objections.objections.map(o => ({
                                  type: o.type,
                                  phrase: o.phrase
                                }))
                              },
                              toneAnalysis: {
                                isRobotic: analysis.toneAnalysis.isRobotic,
                                energyMismatch: analysis.toneAnalysis.energyMismatch,
                                issues: analysis.toneAnalysis.issues
                              },
                              feedbackForAgent: analysis.feedbackForAgent ? {
                                shouldInject: analysis.feedbackForAgent.shouldInject,
                                priority: analysis.feedbackForAgent.priority,
                                type: analysis.feedbackForAgent.type,
                                message: analysis.feedbackForAgent.message,
                                toneReminder: analysis.feedbackForAgent.toneReminder
                              } : null,
                              currentPhase: {
                                id: state.currentPhase,
                                name: currentPhaseName,
                                stepName: currentStepName
                              },
                              analysisTimeMs: analysisTime
                            }
                          };
                          
                          clientWs.send(JSON.stringify(managerAnalysisPayload));
                          console.log(`   📡 Sent sales_manager_analysis event to client`);
                        } catch (sendError: any) {
                          console.warn(`   ⚠️ Failed to send manager analysis to client: ${sendError.message}`);
                        }
                        
                        // Save full analysis reasoning
                        let analysisLog = `📊 StepAdvance: ${stepResult.shouldAdvance} (${(stepResult.confidence * 100).toFixed(0)}%)`;
                        if (analysis.buySignals.detected) {
                          analysisLog += ` | 💰 BuySignals: ${analysis.buySignals.signals.length}`;
                        }
                        if (analysis.objections.detected) {
                          analysisLog += ` | 🛡️ Objections: ${analysis.objections.objections.length}`;
                        }
                        await salesTracker.addReasoning('sales_manager_analysis', analysisLog);
                        
                        // If agent says to advance, call advanceTo on tracker
                        // 🔒 IDEMPOTENCY CHECK: Skip if we already advanced to this state
                        if (stepResult.shouldAdvance && stepResult.nextPhaseId && stepResult.nextStepId && stepResult.confidence >= 0.6) {
                          const alreadyAtTarget = lastAdvancedToState?.phase === stepResult.nextPhaseId && 
                                                  lastAdvancedToState?.step === stepResult.nextStepId;
                          if (!alreadyAtTarget) {
                            console.log(`\n🚀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`🚀 [${connectionId}] ADVANCING STEP!`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                            console.log(`   → FROM: ${state.currentPhase} / ${state.currentStep || 'start'}`);
                            console.log(`   → TO: ${stepResult.nextPhaseId} / ${stepResult.nextStepId}`);
                            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                            await salesTracker.advanceTo(stepResult.nextPhaseId, stepResult.nextStepId, stepResult.reasoning);
                            lastAdvancedToState = { phase: stepResult.nextPhaseId, step: stepResult.nextStepId };
                          } else {
                            console.log(`🔒 [${connectionId}] Skipping duplicate advancement to ${stepResult.nextPhaseId}/${stepResult.nextStepId}`);
                          }
                        } else {
                          console.log(`   ⏸️  NOT advancing: shouldAdvance=${stepResult.shouldAdvance}, confidence=${stepResult.confidence}, hasIds=${!!stepResult.nextPhaseId && !!stepResult.nextStepId}`);
                        }
                      } catch (agentError: any) {
                        console.error(`\n❌ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.error(`❌ [${connectionId}] SALES MANAGER AGENT ERROR`);
                        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.error(`   Error: ${agentError.message}`);
                        console.error(`   Stack: ${agentError.stack?.split('\n').slice(0, 3).join('\n')}`);
                        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        // Non-blocking - don't affect main conversation flow
                      } finally {
                        isAdvancementInProgress = false; // Release lock
                        console.log(`🔓 [${connectionId}] Sales Manager lock released`);
                      }
                    })();
                  } else {
                    if (!trackerClientId || !trackerConsultantId) {
                      console.log(`   ⏭️  SKIPPING: Missing IDs (clientId=${!!trackerClientId}, consultantId=${!!trackerConsultantId})`);
                    } else if (isAdvancementInProgress) {
                      console.log(`   ⏭️  SKIPPING: Another analysis already in progress`);
                    }
                  }
                  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                } catch (trackError: any) {
                  console.error(`❌ [${connectionId}] Sales tracking error:`, trackError.message);
                }
              }
              
              currentAiTranscript = ''; // Reset per prossimo turno
            }
            
            clientWs.send(JSON.stringify({
              type: 'turn_complete'
            }));
          }

          // Session Resumption Update - Save handle for reconnection
          if (response.sessionResumptionUpdate) {
            const update = response.sessionResumptionUpdate;
            if (update.resumable && update.newHandle) {
              console.log(`🔄 [${connectionId}] SESSION RESUMPTION UPDATE received`);
              console.log(`   - New handle: ${update.newHandle.substring(0, 30)}...`);
              console.log(`   - Resumable: ${update.resumable}`);
              
              // CRITICAL: Track last handle server-side for proactive GO AWAY handling
              lastSessionHandle = update.newHandle;
              console.log(`   ✅ Handle saved server-side for proactive reconnect`);
              
              // Save to database with ownership metadata for session isolation
              try {
                await storage.saveGeminiSessionHandle({
                  handle: update.newHandle,
                  mode: mode,
                  userId: (mode === 'sales_agent' || mode === 'consultation_invite') ? null : userId,
                  shareToken: mode === 'sales_agent' ? shareToken || null : null,
                  inviteToken: mode === 'consultation_invite' ? inviteToken || null : null,
                  conversationId: (mode === 'sales_agent' || mode === 'consultation_invite') ? conversationId || null : null,
                  consultantType: mode === 'consulente' ? consultantType : null,
                });
                console.log(`   ✅ Handle saved to database with ownership metadata`);
                console.log(`      → Mode: ${mode}`);
                const isPublicMode = mode === 'sales_agent' || mode === 'consultation_invite';
                console.log(`      → ${isPublicMode ? `${mode === 'sales_agent' ? `ShareToken: ${shareToken}` : `InviteToken: ${inviteToken}`}, ConversationId: ${conversationId}` : `UserId: ${userId}${mode === 'consulente' ? `, ConsultantType: ${consultantType}` : ''}`}`);
              } catch (dbError: any) {
                console.error(`   ⚠️  Failed to save handle to database:`, dbError.message);
                // Non blocchiamo il flusso - il client può comunque usare localStorage
              }
              
              // Send to client to save in localStorage
              clientWs.send(JSON.stringify({
                type: 'session_resumption_update',
                handle: update.newHandle,
                resumable: update.resumable
              }));
            }
          }
        } catch (parseError: any) {
          console.error(`❌ [${connectionId}] Failed to parse Gemini response:`, parseError.message);
        }
      });

      geminiSession.on('error', (error: Error) => {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`❌ [${connectionId}] GEMINI WEBSOCKET ERROR`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Error Type: ${error.name}`);
        console.log(`Error Message: ${error.message}`);
        console.log(`Error Stack:\n${error.stack}`);
        
        // Try to extract more details from error object
        const errorObj = error as any;
        if (errorObj.code) {
          console.log(`Error Code: ${errorObj.code}`);
        }
        if (errorObj.statusCode) {
          console.log(`Status Code: ${errorObj.statusCode}`);
        }
        if (errorObj.response) {
          console.log(`Response Data: ${JSON.stringify(errorObj.response, null, 2)}`);
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        clientWs.send(JSON.stringify({ 
          type: 'error',
          message: 'Gemini WebSocket error',
          details: error.message
        }));
      });

      geminiSession.on('close', (code: number, reason: Buffer) => {
        const reasonText = reason.toString();
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔌 [${connectionId}] GEMINI WEBSOCKET CLOSED`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`❌ Close Code: ${code}`);
        console.log(`📝 Reason: ${reasonText || '(no reason provided)'}`);
        console.log(`\n🔍 Close Code Meanings:`);
        console.log(`   1000 = Normal Closure`);
        console.log(`   1001 = Going Away`);
        console.log(`   1002 = Protocol Error`);
        console.log(`   1003 = Unsupported Data`);
        console.log(`   1006 = Abnormal Closure (no close frame)`);
        console.log(`   1007 = Invalid Frame Payload Data (INVALID ARGUMENT)`);
        console.log(`   1008 = Policy Violation`);
        console.log(`   1009 = Message Too Big`);
        console.log(`   1011 = Internal Server Error`);
        
        if (code === 1007) {
          console.log(`\n⚠️  ERROR 1007: Request contains an invalid argument`);
          console.log(`   Possible causes:`);
          console.log(`   1. Invalid model path format`);
          console.log(`   2. Unsupported voice name for the model`);
          console.log(`   3. Invalid generation_config parameters`);
          console.log(`   4. System instruction too long or malformed`);
          console.log(`   5. Invalid response_modalities configuration`);
          console.log(`\n🔧 Troubleshooting steps:`);
          console.log(`   - Check if model ID is correct: ${vertexConfig.modelId}`);
          console.log(`   - Verify voice "${voiceName}" is supported by this model`);
          console.log(`   - Check system instruction length: ${systemInstruction?.length || 0} chars`);
          console.log(`   - Validate all generation_config parameters`);
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // ⏱️  CLEANUP: Stop time update interval
        if (timeUpdateInterval) {
          clearInterval(timeUpdateInterval);
          timeUpdateInterval = null;
          console.log(`⏱️  [${connectionId}] Time update scheduler stopped (Gemini close)`);
        }
        
        // 💾 CLEANUP: Stop autosave interval
        if (autosaveInterval) {
          clearInterval(autosaveInterval);
          autosaveInterval = null;
          console.log(`💾 [${connectionId}] Autosave interval stopped (Gemini close)`);
        }
        
        // Final cost report
        if (totalInputTokens > 0 || totalOutputTokens > 0) {
          const finalInputCost = (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_1M;
          const finalOutputCost = (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_1M;
          const finalTotalCost = finalInputCost + finalOutputCost;
          
          console.log(`\n💰 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📊 [${connectionId}] SESSION FINAL COST REPORT`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📥 Input (text): ${totalInputTokens.toLocaleString()} tokens`);
          console.log(`   → $${finalInputCost.toFixed(4)} ($${PRICE_INPUT_PER_1M}/1M tokens)`);
          console.log(`📤 Output (audio): ${totalOutputTokens.toLocaleString()} tokens`);
          console.log(`   → $${finalOutputCost.toFixed(4)} ($${PRICE_OUTPUT_PER_1M}/1M tokens)`);
          console.log(`\n💵 TOTAL SESSION COST: $${finalTotalCost.toFixed(4)} USD`);
          console.log(`   (${(totalInputTokens + totalOutputTokens).toLocaleString()} total tokens)`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
        
        isSessionActive = false;
      });

      console.log(`✅ [${connectionId}] Gemini Live session created successfully`);

      // Track last audio log time for throttling
      let lastAudioLogTime = 0;
      const AUDIO_LOG_INTERVAL_MS = 30000; // 30 secondi

      // 4. Browser → Gemini relay
      clientWs.on('message', async (data) => {
        try {
          const msg: LiveMessage = JSON.parse(data.toString());
          
            if (msg.type === 'audio' && msg.data) {

                // 🔥 [NUOVO] INIEZIONE PRE-FLIGHT 🔥
                if (pendingFeedbackForAI && geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
                   console.log(`🚀 [${connectionId}] INJECTING FEEDBACK (Pre-Flight Strategy)`);

                   const feedbackPayload = {
                      clientContent: {
                         turns: [{
                            role: 'user',
                            // Usiamo la variabile che contiene l'istruzione Cipolla
                            parts: [{ text: pendingFeedbackForAI }]
                         }],
                         turnComplete: false // CRITICO: Non chiudere il turno, sta per arrivare l'audio
                      }
                   };
                 geminiSession.send(JSON.stringify(feedbackPayload));
                 pendingFeedbackForAI = null; // Reset immediato
              }
            
            // Log ridotto: solo 1 ogni 30 secondi
            const now = Date.now();
            if (now - lastAudioLogTime >= AUDIO_LOG_INTERVAL_MS) {
              console.log(`🎤 [${connectionId}] Receiving audio chunks (last logged: seq ${msg.sequence || 'N/A'})`);
              lastAudioLogTime = now;
            }
            
            // Send to Gemini Live API using raw WebSocket protocol
            if (geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
              const audioMessage = {
                realtime_input: {
                  media_chunks: [{
                    data: msg.data,  // base64 PCM16
                    mime_type: 'audio/pcm'
                  }]
                }
              };
              geminiSession.send(JSON.stringify(audioMessage));
            }
          }
          
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 🆕 FIX AI TRAINER: Gestire input testuale dal ProspectSimulator
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          if (msg.type === 'text_input' && msg.text) {
            console.log(`\n📝 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📝 [${connectionId}] TEXT INPUT RECEIVED (AI Trainer Mode)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`   📄 Text: "${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}"`);
            console.log(`   📏 Length: ${msg.text.length} chars`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            if (geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
              const textPayload = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: msg.text }]
                  }],
                  turnComplete: true
                }
              };
              
              geminiSession.send(JSON.stringify(textPayload));
              console.log(`✅ [${connectionId}] Text input sent to Gemini`);
              
              if (salesTracker) {
                try {
                  await salesTracker.trackUserMessage(msg.text);
                  console.log(`✅ [${connectionId}] User message tracked for sales script`);
                } catch (trackError: any) {
                  console.error(`⚠️ [${connectionId}] Sales tracking error:`, trackError.message);
                }
              }
              
              const timestamp = new Date().toISOString();
              conversationMessages.push({
                role: 'user',
                transcript: msg.text,
                timestamp: timestamp,
              });
              savedMessageTimestamps.add(timestamp);
              
              clientWs.send(JSON.stringify({
                type: 'user_transcript',
                text: msg.text
              }));
              
            } else {
              console.error(`❌ [${connectionId}] Cannot send text - Gemini session not active`);
            }
          }
          
          if (msg.type === 'end_session') {
            console.log(`👋 [${connectionId}] Client requested session end`);
            
            // Salva conversazione se ci sono dati
            if (msg.conversationData) {
              // Aggiorna i messaggi tracciati con quelli finali dal client
              conversationMessages = msg.conversationData.messages;
              
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // 🎯 SALES SCRIPT TRACKING - Track user messages from final conversation
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              if (salesTracker && msg.conversationData.messages) {
                try {
                  let trackedCount = 0;
                  let skippedCount = 0;
                  
                  for (const message of msg.conversationData.messages) {
                    if (message.role === 'user' && message.transcript) {
                      // ✅ FIX: Check if message timestamp is already saved to avoid duplicates
                      // This prevents re-tracking messages that were already saved in real-time
                      if (!savedMessageTimestamps.has(message.timestamp)) {
                        await salesTracker.trackUserMessage(message.transcript);
                        trackedCount++;
                      } else {
                        skippedCount++;
                      }
                    }
                  }
                  
                  console.log(`✅ [${connectionId}] Sales tracking: processed ${trackedCount} new messages (${skippedCount} duplicates skipped)`);
                } catch (trackError: any) {
                  console.error(`❌ [${connectionId}] Sales tracking error (user messages):`, trackError.message);
                }
              }
              
              if (mode === 'sales_agent' || mode === 'consultation_invite') {
                // Sales Agent / Consultation Invite mode: aggiorna client_sales_conversations
                const modeLabel = mode === 'sales_agent' ? 'Sales Agent' : 'Consultation Invite';
                console.log(`💾 [${connectionId}] Saving ${modeLabel} conversation...`);
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // LOAD CONVERSATION DATA
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const conversation = await storage.getClientSalesConversationById(conversationId!);
                if (!conversation) {
                  console.error(`❌ [${connectionId}] Conversation not found: ${conversationId}`);
                  throw new Error('Conversation not found');
                }
                
                // Build full transcript
                const fullTranscript = msg.conversationData.messages
                  .map((m: any) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.transcript}`)
                  .join('\n\n');
                
                const lowerTranscript = fullTranscript.toLowerCase();
                
                console.log(`\n📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${connectionId}] SALES AGENT TRACKING - ANALYZING CONVERSATION`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   📝 Transcript length: ${fullTranscript.length} chars`);
                console.log(`   📊 Current Phase: ${conversation.currentPhase.toUpperCase()}`);
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 1. PHASE TRANSITION DETECTION
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                let newPhase = conversation.currentPhase;
                
                if (conversation.currentPhase === 'discovery') {
                  if (lowerTranscript.includes('passiamo alla demo') || 
                      lowerTranscript.includes('ti mostro come funziona') ||
                      lowerTranscript.includes('adesso ti mostro') ||
                      lowerTranscript.includes('vediamo come funziona')) {
                    newPhase = 'demo';
                    console.log(`   🔄 PHASE TRANSITION: discovery → demo`);
                  }
                } else if (conversation.currentPhase === 'demo') {
                  if (lowerTranscript.includes('hai qualche domanda') || 
                      lowerTranscript.includes('preoccupazioni') ||
                      lowerTranscript.includes('hai dubbi') ||
                      lowerTranscript.includes('domande o dubbi')) {
                    newPhase = 'objections';
                    console.log(`   🔄 PHASE TRANSITION: demo → objections`);
                  }
                } else if (conversation.currentPhase === 'objections') {
                  if (lowerTranscript.includes('pronto a iniziare') ||
                      lowerTranscript.includes('vuoi procedere') ||
                      lowerTranscript.includes('partiamo') ||
                      lowerTranscript.includes('quando iniziamo')) {
                    newPhase = 'closing';
                    console.log(`   🔄 PHASE TRANSITION: objections → closing`);
                  }
                }
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 2. OBJECTIONS TRACKING
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const objectionKeywords = [
                  'troppo costoso', 'non ho budget', 'devo pensarci',
                  'parlarne con', 'non è il momento', 'già lavoro con',
                  'non funziona', 'non sono sicuro', 'non ho tempo',
                  'troppo caro', 'non posso permettermi', 'devo valutare',
                  'ci devo pensare', 'non sono convinto', 'troppo impegnato'
                ];
                
                const detectedObjections: string[] = [];
                for (const keyword of objectionKeywords) {
                  if (lowerTranscript.includes(keyword)) {
                    detectedObjections.push(keyword);
                  }
                }
                
                if (detectedObjections.length > 0) {
                  console.log(`   ⚠️  OBJECTIONS DETECTED: ${detectedObjections.length}`);
                  detectedObjections.forEach(obj => console.log(`      - "${obj}"`));
                }
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 3. COLLECTED DATA EXTRACTION
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const collectedData: any = { ...conversation.collectedData };
                let dataExtracted = false;
                
                // Business extraction
                const businessMatch = fullTranscript.match(/la mia azienda (è|si chiama) ([^.!?,\n]+)/i);
                if (businessMatch && !collectedData.business) {
                  collectedData.business = businessMatch[2].trim();
                  console.log(`   📊 EXTRACTED - Business: "${collectedData.business}"`);
                  dataExtracted = true;
                }
                
                // Alternative business patterns
                const businessMatch2 = fullTranscript.match(/lavoro (in|per|con) ([^.!?,\n]+)/i);
                if (businessMatch2 && !collectedData.business) {
                  collectedData.business = businessMatch2[2].trim();
                  console.log(`   📊 EXTRACTED - Business: "${collectedData.business}"`);
                  dataExtracted = true;
                }
                
                // Pain points extraction
                if (lowerTranscript.includes('problema') || lowerTranscript.includes('difficoltà') || 
                    lowerTranscript.includes('sfida') || lowerTranscript.includes('fatica')) {
                  
                  if (!collectedData.painPoints) {
                    collectedData.painPoints = [];
                  }
                  
                  // Extract context around pain point keywords
                  const painPatterns = [
                    /ho (un )?problema (con|a|di) ([^.!?\n]{5,100})/gi,
                    /la difficoltà (è|sta) ([^.!?\n]{5,100})/gi,
                    /faccio fatica (a|con) ([^.!?\n]{5,100})/gi,
                    /la sfida (è|sta) ([^.!?\n]{5,100})/gi
                  ];
                  
                  for (const pattern of painPatterns) {
                    const matches = [...fullTranscript.matchAll(pattern)];
                    for (const match of matches) {
                      const painPoint = match[0].substring(0, 150); // Max 150 chars
                      if (!collectedData.painPoints.includes(painPoint)) {
                        collectedData.painPoints.push(painPoint);
                        console.log(`   💡 EXTRACTED - Pain Point: "${painPoint}"`);
                        dataExtracted = true;
                      }
                    }
                  }
                }
                
                // Budget mentions
                const budgetMatch = fullTranscript.match(/budget.*?(\d+[\.,]?\d*)\s*(euro|€|k|mila|migliaia)/i);
                if (budgetMatch && !collectedData.budget) {
                  collectedData.budget = budgetMatch[0].trim();
                  console.log(`   💰 EXTRACTED - Budget: "${collectedData.budget}"`);
                  dataExtracted = true;
                }
                
                // Urgency detection
                if (lowerTranscript.includes('urgente') || lowerTranscript.includes('subito') || 
                    lowerTranscript.includes('al più presto') || lowerTranscript.includes('immediatamente')) {
                  collectedData.urgency = 'high';
                  console.log(`   ⏰ EXTRACTED - Urgency: HIGH`);
                  dataExtracted = true;
                } else if (lowerTranscript.includes('non ho fretta') || lowerTranscript.includes('con calma')) {
                  collectedData.urgency = 'low';
                  console.log(`   ⏰ EXTRACTED - Urgency: LOW`);
                  dataExtracted = true;
                }
                
                // Decision maker detection
                if (lowerTranscript.includes('sono il proprietario') || lowerTranscript.includes('decido io') ||
                    lowerTranscript.includes('sono il responsabile')) {
                  collectedData.isDecisionMaker = true;
                  console.log(`   👤 EXTRACTED - Decision Maker: YES`);
                  dataExtracted = true;
                } else if (lowerTranscript.includes('devo parlarne con') || lowerTranscript.includes('non decido io')) {
                  collectedData.isDecisionMaker = false;
                  console.log(`   👤 EXTRACTED - Decision Maker: NO`);
                  dataExtracted = true;
                }
                
                if (!dataExtracted) {
                  console.log(`   ℹ️  No new data extracted from transcript`);
                }
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 4. OUTCOME DETECTION
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                let outcome = conversation.outcome;
                
                // Interested signals (strong positive)
                if (lowerTranscript.includes('sono interessato') || 
                    lowerTranscript.includes('voglio procedere') ||
                    lowerTranscript.includes('quando possiamo iniziare') ||
                    lowerTranscript.includes('partiamo') ||
                    lowerTranscript.includes('perfetto, procediamo') ||
                    lowerTranscript.includes('mi hai convinto')) {
                  outcome = 'interested';
                  console.log(`   ✅ OUTCOME: INTERESTED (positive signals detected)`);
                }
                
                // Not interested signals (strong negative)
                else if (lowerTranscript.includes('non sono interessato') ||
                    lowerTranscript.includes('non fa per me') ||
                    lowerTranscript.includes('non mi interessa') ||
                    lowerTranscript.includes('ci rinuncio') ||
                    lowerTranscript.includes('non è quello che cerco')) {
                  outcome = 'not_interested';
                  console.log(`   ❌ OUTCOME: NOT INTERESTED (negative signals detected)`);
                }
                
                // Weak interested (thinking about it - keep as pending)
                else if (lowerTranscript.includes('ci penso') || 
                    lowerTranscript.includes('ci devo pensare') ||
                    lowerTranscript.includes('devo valutare')) {
                  outcome = 'pending';
                  console.log(`   ⏳ OUTCOME: PENDING (prospect needs time to think)`);
                }
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 5. UPDATE DATABASE
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                
                // Merge objections (avoid duplicates)
                const existingObjections = conversation.objectionsRaised || [];
                const allObjections = [...new Set([...existingObjections, ...detectedObjections])];
                
                console.log(`\n   💾 UPDATING DATABASE:`);
                console.log(`      - Phase: ${newPhase}`);
                console.log(`      - Objections: ${allObjections.length} total`);
                console.log(`      - Outcome: ${outcome}`);
                console.log(`      - Collected Data fields: ${Object.keys(collectedData).length}`);
                
                await storage.updateClientSalesConversation(conversationId!, {
                  currentPhase: newPhase,
                  collectedData: collectedData,
                  objectionsRaised: allObjections,
                  outcome: outcome
                });
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 6. SAVE NEW MESSAGES TO AI CONVERSATION (for session continuity)
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                if (currentAiConversationId) {
                  // Filter out already-saved messages to avoid duplicates
                  const newMessages = conversationMessages.filter(m => !savedMessageTimestamps.has(m.timestamp));
                  
                  if (newMessages.length > 0) {
                    console.log(`\n   💬 SAVING ${newMessages.length} NEW MESSAGES to aiConversation ${currentAiConversationId}...`);
                    
                    try {
                      // Buffer timestamps locally - only commit to global set after transaction succeeds
                      const tempTimestamps: string[] = [];
                      
                      // Use transaction to ensure atomicity
                      await db.transaction(async (tx) => {
                        // Save NEW messages to aiMessages table
                        for (const singleMsg of newMessages) {
                          await tx.insert(aiMessages).values({
                            conversationId: currentAiConversationId,
                            role: singleMsg.role,
                            content: singleMsg.transcript,
                            messageType: 'voice',
                            durationSeconds: singleMsg.duration,
                            status: 'completed',
                            createdAt: new Date(singleMsg.timestamp)
                          });
                          
                          // Buffer timestamp locally - don't add to global set yet
                          tempTimestamps.push(singleMsg.timestamp);
                        }
                        
                        // Update lastMessageAt timestamp
                        await tx.update(aiConversations)
                          .set({ 
                            lastMessageAt: new Date(),
                            updatedAt: new Date()
                          })
                          .where(eq(aiConversations.id, currentAiConversationId));
                      });
                      
                      // Transaction succeeded - now it's safe to mark messages as saved
                      tempTimestamps.forEach(ts => savedMessageTimestamps.add(ts));
                      
                      console.log(`   ✅ Saved ${newMessages.length} new messages to aiConversation (transaction committed)`);
                    } catch (err: any) {
                      console.error(`   ❌ Failed to save messages to aiConversation:`, err.message);
                      throw err; // Re-throw to prevent marking conversation as saved
                    }
                  } else {
                    console.log(`   ℹ️  No new messages to save (all ${conversationMessages.length} already persisted)`);
                  }
                } else {
                  console.warn(`   ⚠️  No aiConversationId - messages not saved (conversation will lose memory on reconnect)`);
                }
                
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                
                conversationSaved = true;
                
                // Notifica client
                clientWs.send(JSON.stringify({
                  type: 'conversation_saved',
                  conversationId: conversationId!
                }));
                
                console.log(`✅ [${connectionId}] Sales Agent conversation saved with tracking data and message history`);
              } else {
                // Client mode: usa saveConversation normale
                const savedConversationId = await saveConversation(
                  userId!, 
                  consultantId!, 
                  msg.conversationData, 
                  voiceName,
                  sessionType
                );
                
                conversationSaved = true;
                
                // Notifica client che la conversazione è stata salvata
                clientWs.send(JSON.stringify({
                  type: 'conversation_saved',
                  conversationId: savedConversationId
                }));
              }
            }
            
            if (geminiSession && geminiSession.readyState === WebSocket.OPEN) {
              geminiSession.close();
              isSessionActive = false;
            }
            
            clientWs.close(1000, 'Session ended normally');
          }
          
          // Ricevi aggiornamenti periodici dei messaggi dal client (auto-save)
          if (msg.type === 'conversation_update') {
            if (msg.conversationData && msg.conversationData.messages) {
              const clientMessages = msg.conversationData.messages;
              
              // MERGE strategy: usa client se ha più messaggi O stesso numero ma è più completo
              // (client ha audio buffers e durate accurate)
              // Ignora update vuoti o più corti che potrebbero essere stale
              if (clientMessages.length === 0) {
                console.log(`📝 [${connectionId}] Ignoring empty client update, keeping server messages (${conversationMessages.length})`);
              } else if (clientMessages.length >= conversationMessages.length) {
                conversationMessages = clientMessages;
                console.log(`📝 [${connectionId}] Conversation update: ${conversationMessages.length} messages (client authoritative - has audio & durations)`);
              } else {
                console.log(`📝 [${connectionId}] Keeping server messages (${conversationMessages.length}) - client snapshot is shorter (${clientMessages.length})`);
              }
            }
          }

          if (msg.type === 'ping') {
            clientWs.send(JSON.stringify({ 
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
          }

          // 💾 FLUSH MESSAGES - Force immediate save to database before reconnect
          if (msg.type === 'flush_messages') {
            console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`[${connectionId}] FLUSH MESSAGES REQUEST - Forcing immediate database save`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`   Mode: ${mode}`);
            console.log(`   Messages to flush: ${conversationMessages.length}`);
            console.log(`   Timestamp: ${new Date().toISOString()}`);
            
            // Only flush for sales_agent and consultation_invite modes
            if (mode !== 'sales_agent' && mode !== 'consultation_invite') {
              console.log(`   ⏭️  Skipping flush - mode '${mode}' doesn't use database persistence`);
              clientWs.send(JSON.stringify({
                type: 'flush_complete',
                messagesSaved: 0,
                skipped: true,
                reason: 'Mode does not use database persistence'
              }));
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              return;
            }

            try {
              const flushStartTime = Date.now();
              
              // PERSIST PENDING AI TRANSCRIPT: save any in-flight AI message
              if (currentAiTranscript.trim()) {
                conversationMessages.push({
                  role: 'assistant',
                  transcript: currentAiTranscript.trim(),
                  duration: 0,
                  timestamp: new Date().toISOString()
                });
                console.log(`   💬 Added pending AI message to flush queue: "${currentAiTranscript.substring(0, 50)}..."`);
                currentAiTranscript = '';
              }

              if (conversationMessages.length === 0) {
                console.log(`   ℹ️  No messages to flush - queue is empty`);
                clientWs.send(JSON.stringify({
                  type: 'flush_complete',
                  messagesSaved: 0,
                  duration: Date.now() - flushStartTime
                }));
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                return;
              }

              // VALIDATE aiConversationId exists
              if (!currentAiConversationId) {
                console.error(`   ❌ CRITICAL: No aiConversationId - cannot flush messages`);
                clientWs.send(JSON.stringify({
                  type: 'flush_error',
                  error: 'No conversation ID available',
                  messagesSaved: 0
                }));
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                return;
              }

              // Filter out already-saved messages to avoid duplicates
              const newMessages = conversationMessages.filter(m => !savedMessageTimestamps.has(m.timestamp));
              
              if (newMessages.length === 0) {
                console.log(`   ✅ All ${conversationMessages.length} messages already saved - nothing to flush`);
                clientWs.send(JSON.stringify({
                  type: 'flush_complete',
                  messagesSaved: 0,
                  totalMessages: conversationMessages.length,
                  alreadySaved: true,
                  duration: Date.now() - flushStartTime
                }));
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                return;
              }

              console.log(`   💾 Flushing ${newMessages.length} new messages to database (${conversationMessages.length - newMessages.length} already saved)...`);
              
              // Buffer timestamps locally - only commit to global set after transaction succeeds
              const tempTimestamps: string[] = [];
              
              // Use transaction to ensure atomicity
              await db.transaction(async (tx) => {
                // Save NEW messages to aiMessages table
                for (const singleMsg of newMessages) {
                  await tx.insert(aiMessages).values({
                    conversationId: currentAiConversationId!,
                    role: singleMsg.role,
                    content: singleMsg.transcript,
                    messageType: 'voice',
                    durationSeconds: singleMsg.duration,
                    status: 'completed',
                    createdAt: new Date(singleMsg.timestamp)
                  });
                  
                  // Buffer timestamp locally - don't add to global set yet
                  tempTimestamps.push(singleMsg.timestamp);
                }
                
                // Update lastMessageAt timestamp
                await tx.update(aiConversations)
                  .set({ 
                    lastMessageAt: new Date(),
                    updatedAt: new Date()
                  })
                  .where(eq(aiConversations.id, currentAiConversationId!));
              });
              
              // Transaction succeeded - now it's safe to mark messages as saved
              tempTimestamps.forEach(ts => savedMessageTimestamps.add(ts));
              
              const flushDuration = Date.now() - flushStartTime;
              
              console.log(`   ✅ FLUSH COMPLETE - ${newMessages.length} messages saved successfully`);
              console.log(`   ⏱️  Flush duration: ${flushDuration}ms`);
              console.log(`   📊 Total saved: ${savedMessageTimestamps.size}/${conversationMessages.length} messages`);
              
              // Send success response to client
              clientWs.send(JSON.stringify({
                type: 'flush_complete',
                messagesSaved: newMessages.length,
                totalMessages: conversationMessages.length,
                duration: flushDuration,
                timestamp: new Date().toISOString()
              }));
              
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            } catch (error: any) {
              console.error(`   ❌ FLUSH FAILED:`, error.message);
              console.error(`   Stack:`, error.stack);
              
              // Send error response to client
              clientWs.send(JSON.stringify({
                type: 'flush_error',
                error: error.message,
                messagesSaved: 0
              }));
              
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            }
          }
        } catch (error: any) {
          console.error(`❌ [${connectionId}] Error processing message:`, error);
          clientWs.send(JSON.stringify({ 
            type: 'error',
            message: error.message 
          }));
        }
      });

      // 5. Cleanup (callbacks handle Gemini → Browser relay)
      clientWs.on('close', async (code, reason) => {
        console.log(`❌ [${connectionId}] Client disconnected - Code: ${code}, Reason: ${reason}`);
        isSessionActive = false;
        
        // 🔴 CACHE CLEANUP: Rimuovi sessione dalla cache
        if (currentConsultationId) {
          removeActiveSession(currentConsultationId);
        }
        
        // 🎯 SALES SCRIPT TRACKING CLEANUP
        if (salesTracker && conversationId) {
          try {
            const state = salesTracker.getState();
            if (salesLogger) {
              salesLogger.logConversationSummary({
                phasesReached: state.phasesReached,
                checkpointsCompleted: state.checkpointsCompleted.length,
                totalCheckpoints: 9, // From JSON structure
                ladderActivations: state.ladderActivations.length,
                questionsAsked: state.questionsAsked.length,
                duration: Math.floor((Date.now() - new Date().getTime()) / 1000),
                completionRate: salesTracker.getCompletionRate()
              });
            }
            
            // 💾 CRITICAL FIX: Save final state to database before removing tracker
            console.log(`💾 [${connectionId}] Saving final training state before disconnect...`);
            await salesTracker.saveFinalState();
            console.log(`✅ [${connectionId}] Final training state saved successfully`);
            
            removeTracker(conversationId);
            console.log(`✅ [${connectionId}] Sales tracker cleaned up`);
          } catch (error: any) {
            console.error(`❌ [${connectionId}] Sales tracker cleanup error:`, error.message);
          }
        }
        
        // ⏱️  CLEANUP: Stop time update interval
        if (timeUpdateInterval) {
          clearInterval(timeUpdateInterval);
          timeUpdateInterval = null;
          console.log(`⏱️  [${connectionId}] Time update scheduler stopped (client close)`);
        }
        
        // 💾 CLEANUP: Stop autosave interval
        if (autosaveInterval) {
          clearInterval(autosaveInterval);
          autosaveInterval = null;
          console.log(`💾 [${connectionId}] Autosave interval stopped (client close)`);
        }
        
        // 🔒 CLEANUP: Stop close timers
        if (closeCheckInterval) {
          clearInterval(closeCheckInterval);
          closeCheckInterval = null;
          console.log(`🔒 [${connectionId}] Close check interval stopped`);
        }
        if (hardTimeoutTimer) {
          clearTimeout(hardTimeoutTimer);
          hardTimeoutTimer = null;
          console.log(`🔒 [${connectionId}] Hard timeout timer cleared`);
        }
        
        // PERSIST PENDING AI TRANSCRIPT: se c'è un messaggio AI in-flight, salvalo prima di chiudere
        if (currentAiTranscript.trim()) {
          conversationMessages.push({
            role: 'assistant',
            transcript: currentAiTranscript.trim(),
            duration: 0,
            timestamp: new Date().toISOString()
          });
          console.log(`💾 [${connectionId}] Saved pending AI message on close: "${currentAiTranscript.substring(0, 50)}..."`);
          currentAiTranscript = '';
        }
        
        // AUTO-SAVE: Salva conversazione se non già salvata e ci sono messaggi
        if (!conversationSaved && conversationMessages.length > 0) {
          console.log(`💾 [${connectionId}] AUTO-SAVE: Saving ${conversationMessages.length} messages before closing...`);
          try {
            if (mode === 'sales_agent' || mode === 'consultation_invite') {
              // For sales_agent and consultation_invite: save NEW messages to existing aiConversation
              const modeLabel = mode === 'sales_agent' ? 'sales agent' : 'consultation invite';
              
              // FALLBACK: If aiConversationId is still NULL, create it NOW to avoid losing messages
              if (!currentAiConversationId && conversationId) {
                console.warn(`⚠️  [${connectionId}] FALLBACK: aiConversationId is NULL at save time - creating NOW to prevent message loss`);
                
                // Retry logic for fallback creation
                let fallbackRetryCount = 0;
                const fallbackMaxRetries = 3;
                let fallbackSuccess = false;
                
                while (!fallbackSuccess && fallbackRetryCount < fallbackMaxRetries) {
                  try {
                    const conversation = await storage.getClientSalesConversationById(conversationId);
                    if (conversation) {
                      const [newAiConversation] = await db.insert(aiConversations).values({
                        clientId: null,
                        salesConversationId: conversationId,
                        title: `${modeLabel}: ${conversation.prospectName}`,
                        mode: 'live_voice',
                        lastMessageAt: new Date(),
                        createdAt: new Date(),
                        updatedAt: new Date()
                      }).returning();
                      
                      currentAiConversationId = newAiConversation.id;
                      
                      await storage.updateClientSalesConversation(conversationId, {
                        aiConversationId: currentAiConversationId
                      });
                      
                      console.log(`✅ [${connectionId}] FALLBACK: Created aiConversation ${currentAiConversationId} at save time`);
                      fallbackSuccess = true;
                    } else {
                      console.error(`❌ [${connectionId}] FALLBACK: Conversation not found in database`);
                      break;
                    }
                  } catch (fallbackErr: any) {
                    fallbackRetryCount++;
                    console.error(`❌ [${connectionId}] FALLBACK: Failed to create aiConversation (attempt ${fallbackRetryCount}/${fallbackMaxRetries}):`, fallbackErr.message);
                    
                    if (fallbackRetryCount < fallbackMaxRetries) {
                      const backoffMs = Math.min(1000 * Math.pow(2, fallbackRetryCount - 1), 5000);
                      console.log(`   ⏳ FALLBACK: Retrying in ${backoffMs}ms...`);
                      await new Promise(resolve => setTimeout(resolve, backoffMs));
                    } else {
                      console.error(`❌ [${connectionId}] CRITICAL: FALLBACK failed all ${fallbackMaxRetries} attempts`);
                      console.error(`   💥 MESSAGE LOSS CONFIRMED: ${conversationMessages.length} messages LOST`);
                      console.error(`   Error details:`, fallbackErr);
                      
                      // Log lost messages for forensic recovery
                      console.error(`\n╔${'═'.repeat(78)}╗`);
                      console.error(`║ 🚨 FORENSIC LOG: LOST MESSAGES                                           ║`);
                      console.error(`╠${'═'.repeat(78)}╣`);
                      conversationMessages.forEach((msg, idx) => {
                        const preview = msg.transcript.substring(0, 50).replace(/\n/g, ' ');
                        console.error(`║ [${idx + 1}/${conversationMessages.length}] ${msg.role.toUpperCase()}: "${preview}${msg.transcript.length > 50 ? '...' : ''}"`.padEnd(79) + '║');
                        console.error(`║    Time: ${msg.timestamp}`.padEnd(79) + '║');
                      });
                      console.error(`╚${'═'.repeat(78)}╝\n`);
                      
                      // Throw error to make failure visible in monitoring systems
                      throw new Error(`CRITICAL: Failed to persist ${conversationMessages.length} messages after ${fallbackMaxRetries} retry attempts`);
                    }
                  }
                }
              }
              
              if (currentAiConversationId) {
                // Filter out already-saved messages to avoid duplicates
                const newMessages = conversationMessages.filter(msg => !savedMessageTimestamps.has(msg.timestamp));
                
                if (newMessages.length > 0) {
                  console.log(`💾 [${connectionId}] Saving ${newMessages.length} new ${modeLabel} messages to aiConversation ${currentAiConversationId}...`);
                  
                  // Buffer timestamps locally - only commit to global set after transaction succeeds
                  const tempTimestamps: string[] = [];
                  
                  // Use transaction to ensure atomicity
                  await db.transaction(async (tx) => {
                    // Save NEW messages to aiMessages table
                    for (const msg of newMessages) {
                      await tx.insert(aiMessages).values({
                        conversationId: currentAiConversationId!,
                        role: msg.role,
                        content: msg.transcript,
                        messageType: 'voice',
                        durationSeconds: msg.duration,
                        status: 'completed',
                        createdAt: new Date(msg.timestamp)
                      });
                      
                      // Buffer timestamp locally - don't add to global set yet
                      tempTimestamps.push(msg.timestamp);
                    }
                    
                    // Update lastMessageAt timestamp
                    await tx.update(aiConversations)
                      .set({ 
                        lastMessageAt: new Date(),
                        updatedAt: new Date()
                      })
                      .where(eq(aiConversations.id, currentAiConversationId!));
                  });
                  
                  // Transaction succeeded - now it's safe to mark messages as saved
                  tempTimestamps.forEach(ts => savedMessageTimestamps.add(ts));
                  
                  console.log(`✅ [${connectionId}] AUTO-SAVE: ${newMessages.length} new ${modeLabel} messages saved successfully (transaction committed)`);
                } else {
                  console.log(`ℹ️  [${connectionId}] AUTO-SAVE: No new messages to save (all ${conversationMessages.length} already persisted)`);
                }
              } else {
                console.error(`❌ [${connectionId}] CRITICAL: Could not create aiConversationId - MESSAGES LOST: ${conversationMessages.length} messages`);
              }
            } else {
              // Normal mode: use saveConversation function
              const conversationData = {
                messages: conversationMessages,
                duration: 0,
                mode: mode
              };
              
              await saveConversation(
                userId!,
                consultantId!,
                conversationData,
                voiceName,
                sessionType
              );
              console.log(`✅ [${connectionId}] AUTO-SAVE: Conversation saved successfully`);
            }
          } catch (error: any) {
            console.error(`❌ [${connectionId}] AUTO-SAVE: Failed to save conversation:`, error);
            
            // Re-throw CRITICAL errors to prevent silent message loss
            if (error.message && error.message.includes('CRITICAL: Failed to persist')) {
              console.error(`🚨 [${connectionId}] RE-THROWING CRITICAL ERROR to prevent message loss`);
              throw error; // This will crash the close handler, preventing silent message loss
            }
          }
        } else if (conversationSaved) {
          console.log(`✓ [${connectionId}] Conversation already saved, skipping auto-save`);
        } else {
          console.log(`ℹ️ [${connectionId}] No messages to save`);
        }
        
        if (geminiSession && geminiSession.readyState === WebSocket.OPEN) {
          try {
            geminiSession.close();
          } catch (error) {
            console.error(`❌ [${connectionId}] Error closing Gemini session:`, error);
          }
        }
      });

      clientWs.on('error', (error) => {
        console.error(`❌ [${connectionId}] WebSocket error:`, error);
        isSessionActive = false;
      });

    } catch (error: any) {
      console.error(`❌ [${connectionId}] Failed to setup Live session:`, error);
      clientWs.send(JSON.stringify({ 
        type: 'error',
        message: 'Failed to initialize Live session',
        details: error.message
      }));
      clientWs.close(4500, 'Server error');
    }
  });

  console.log('✅ Gemini Live API WebSocket server setup on /ws/ai-voice');
}

/**
 * Salva conversazione vocale nel database
 */
async function saveConversation(
  userId: string,
  consultantId: string,
  conversationData: NonNullable<LiveMessage['conversationData']>,
  voiceName?: string,
  sessionType?: 'weekly_consultation' | null
): Promise<string> {
  try {
    console.log(`💾 Saving voice conversation for user ${userId} (consultant: ${consultantId})...`);

    // Trova il timestamp dell'ultimo messaggio per lastMessageAt
    const lastMessageTimestamp = conversationData.messages.length > 0
      ? new Date(conversationData.messages[conversationData.messages.length - 1].timestamp)
      : new Date();

    // Crea conversazione
    const [conversation] = await db.insert(aiConversations).values({
      clientId: userId,
      title: generateConversationTitle(conversationData.messages),
      mode: 'live_voice',
      lastMessageAt: lastMessageTimestamp,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Salva messaggi
    for (const msg of conversationData.messages) {
      const messageId = Math.random().toString(36).substring(2, 15);
      
      // Salva audio se presente
      let audioUrl: string | null = null;
      if (msg.audioBuffer) {
        if (msg.role === 'user') {
          audioUrl = await saveAudioToStorage(msg.audioBuffer, userId, conversation.id, `user-${messageId}`);
        } else {
          audioUrl = await saveAudioToStorage(msg.audioBuffer, userId, conversation.id, `ai-${messageId}`);
        }
      }

      await db.insert(aiMessages).values({
        conversationId: conversation.id,
        role: msg.role,
        content: msg.transcript,
        messageType: 'voice',
        audioUrl: msg.role === 'user' ? audioUrl : null,
        aiAudioUrl: msg.role === 'assistant' ? audioUrl : null,
        durationSeconds: msg.duration,
        voiceUsed: msg.role === 'assistant' && voiceName ? voiceName : null,
        status: 'completed',
        createdAt: new Date(msg.timestamp)
      });
    }

    // Se è una consulenza settimanale, aggiorna la tabella ai_weekly_consultations
    if (sessionType === 'weekly_consultation') {
      console.log(`📅 [CONSULTATION] Updating weekly consultation record...`);
      
      // Crea full transcript dai messaggi
      const fullTranscript = conversationData.messages
        .map((msg, index) => {
          const role = msg.role === 'user' ? 'Cliente' : 'AI';
          const timestamp = new Date(msg.timestamp).toLocaleTimeString('it-IT');
          return `[${timestamp}] ${role}: ${msg.transcript}`;
        })
        .join('\n\n');
      
      // Trova la consulenza attiva per questo utente
      const activeConsultations = await db.select()
        .from(aiWeeklyConsultations)
        .where(
          and(
            eq(aiWeeklyConsultations.clientId, userId),
            eq(aiWeeklyConsultations.consultantId, consultantId),
            gte(aiWeeklyConsultations.scheduledFor, new Date(Date.now() - 90 * 60 * 1000)) // Ultimi 90 minuti
          )
        )
        .limit(1);
      
      if (activeConsultations.length > 0) {
        const consultation = activeConsultations[0];
        
        await db.update(aiWeeklyConsultations)
          .set({
            conversationId: conversation.id,
            fullTranscript: fullTranscript,
            status: 'completed',
            completedAt: new Date()
          })
          .where(eq(aiWeeklyConsultations.id, consultation.id));
        
        console.log(`✅ [CONSULTATION] Updated consultation ${consultation.id} with transcript (${fullTranscript.length} chars)`);
      } else {
        console.warn(`⚠️ [CONSULTATION] No active consultation found for user ${userId}`);
      }
    }

    console.log(`✅ Conversation saved: ${conversation.id} with ${conversationData.messages.length} messages`);
    return conversation.id;
  } catch (error) {
    console.error('❌ Error saving conversation:', error);
    throw error;
  }
}

/**
 * Genera titolo conversazione dai primi messaggi
 */
function generateConversationTitle(messages: any[]): string {
  if (messages.length === 0) return 'Conversazione vocale';
  
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (firstUserMessage && firstUserMessage.transcript) {
    // Prendi primi 50 caratteri
    return firstUserMessage.transcript.substring(0, 50).trim() + 
           (firstUserMessage.transcript.length > 50 ? '...' : '');
  }
  
  return 'Conversazione vocale';
}

/**
 * Salva audio nel filesystem locale
 */
async function saveAudioToStorage(
  audioBase64: string,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<string | null> {
  try {
    const { uploadAudio, base64ToBuffer } = await import('../storage/audio-storage');
    const audioBuffer = base64ToBuffer(audioBase64);
    const result = await uploadAudio(audioBuffer, userId, conversationId, messageId);
    return result.publicUrl;
  } catch (error) {
    console.error('❌ Error saving audio to storage:', error);
    return null;
  }
}
