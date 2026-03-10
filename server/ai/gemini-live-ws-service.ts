import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { getVertexAITokenForLive, getGoogleAIStudioKeyForLive, getAIProvider } from './provider-factory';
import { 
  convertWebMToPCM, 
  convertPCMToWAV, 
  base64ToBuffer,
  bufferToBase64 
} from './audio-converter';
import { db } from '../db';
import { aiConversations, aiMessages, aiWeeklyConsultations, vertexAiUsageTracking, clientSalesConversations, salesScripts, consultantAvailabilitySettings, voiceCalls, consultantWhatsappConfig, proactiveLeads, consultantDetailedProfiles } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { eq, and, gte } from 'drizzle-orm';
import { storage } from '../storage';
import { buildUserContext } from '../ai-context-builder';
import { resolveHunterContext, formatHunterContextForPrompt, type HunterLeadContext } from '../services/hunter-context-resolver';
import { buildSystemPrompt } from '../ai-prompts';
import { buildSalesAgentPrompt, buildStaticSalesAgentPrompt, buildSalesAgentDynamicContext, buildMinimalSalesAgentInstruction, buildFullSalesAgentContext, buildFullSalesAgentContextAsync, ScriptPosition } from './sales-agent-prompt-builder';
import { getOrCreateTracker, removeTracker, SalesScriptTracker } from './sales-script-tracker';
import { createSalesLogger, SalesScriptLogger } from './sales-script-logger';
import { SalesManagerAgent } from './sales-manager-agent';
import { generateDiscoveryRec, type DiscoveryRec } from './discovery-rec-generator';
import type { SalesManagerParams, SalesManagerAnalysis, BusinessContext } from './sales-manager-agent';
import { getTemplateById, resolveTemplateVariables, INBOUND_TEMPLATES, OUTBOUND_TEMPLATES } from '../voice/voice-templates';
import { VoiceBookingSupervisor, ConversationMessage as BookingMessage, AvailableSlot } from '../voice/voice-booking-supervisor';
import { VoiceTaskSupervisor, TaskConversationMessage, TaskSupervisorResult } from '../voice/voice-task-supervisor';
import { executeConsultationTool } from './consultation-tool-executor';
import { tokenTracker } from './token-tracker';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key';

const VOICE_CACHE_TTL = 5 * 60 * 1000;
const _voiceNumbersCache = new Map<string, { data: any; ts: number }>();
const _rejectedNumbersCache = new Map<string, { count: number; ts: number }>();
const REJECTED_CACHE_TTL = 60 * 1000;
const REJECTED_MAX_LOG = 3;
const _settingsCache = new Map<string, { data: any[]; ts: number }>();
const _consultantInfoCache = new Map<string, { data: any; ts: number }>();

function getCached<T>(cache: Map<string, { data: T; ts: number }>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < VOICE_CACHE_TTL) return entry.data;
  if (entry) cache.delete(key);
  return null;
}

export function invalidateVoiceCache(consultantId: string) {
  _settingsCache.delete(consultantId);
  _consultantInfoCache.delete(consultantId);
}

export function invalidateVoiceNumberCache(phoneNumber: string) {
  _voiceNumbersCache.delete(phoneNumber);
}

/**
 * Strip AI thinking/reasoning content from message text.
 * Gemini with thinking enabled produces text like:
 *   **Bold Header**\n\nReasoning paragraph...\n\n**Another Header**\n\nMore reasoning...\n\nActual spoken text
 * This function removes all the thinking blocks and returns only the spoken content.
 */
function stripAiThinking(text: string): string {
  if (!text) return text;
  
  // Pattern: **Bold Title** followed by reasoning paragraphs
  // The actual spoken text is what remains after removing all **...** blocks and their following paragraphs
  let cleaned = text;
  
  // Remove blocks that start with **Title** and their content until next **Title** or actual speech
  // These thinking blocks follow the pattern: **Title**\n\nReasoning text that describes what AI is doing
  cleaned = cleaned.replace(/\*\*[^*]+\*\*\s*\n+[^]*?(?=\n\n(?:[^*\n])|$)/g, '');
  
  // Simpler approach: Remove all lines that are **Bold Headers** and lines that describe AI internal reasoning
  // Split by double newline to get paragraphs
  const paragraphs = text.split(/\n\n+/);
  const spokenParagraphs: string[] = [];
  
  let skipNext = false;
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;
    
    // Skip **Bold Title** paragraphs (these are thinking headers)
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      skipNext = true;
      continue;
    }
    
    // Skip reasoning paragraphs that follow a bold header
    // These typically describe what the AI is doing/thinking
    if (skipNext) {
      // Check if this looks like reasoning (starts with "I'm", "I've", "I need", "I want", "I understand", "I realize", etc.)
      if (/^(I'm |I've |I need |I want |I understand |I realize |I detect |I should |My |The |This |Now |Based on |Following |Maintaining |Keeping |Focusing )/i.test(p)) {
        continue; // Skip this reasoning paragraph
      }
      skipNext = false;
    }
    
    spokenParagraphs.push(p);
  }
  
  const result = spokenParagraphs.join('\n').trim();
  return result || text; // Fallback to original if stripping removed everything
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🏢 BUILD BRAND VOICE FROM WHATSAPP AGENT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Loads business context from a WhatsApp agent to inject into voice call prompts.
 * Uses in-memory cache (TTL 10min) to avoid DB hit on every call.
 */
const brandVoiceCache = new Map<string, { text: string; timestamp: number }>();
const BRAND_VOICE_CACHE_TTL_MS = 10 * 60 * 1000;

async function buildBrandVoiceFromAgent(agentId: string): Promise<string> {
  try {
    const cached = brandVoiceCache.get(agentId);
    if (cached && (Date.now() - cached.timestamp) < BRAND_VOICE_CACHE_TTL_MS) {
      console.log(`🏢 [BrandVoice] Cache HIT for agent ${agentId} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.text;
    }

    const agentResult = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentId));
    
    if (agentResult.length === 0) {
      brandVoiceCache.set(agentId, { text: '', timestamp: Date.now() });
      return '';
    }
    
    const agent = agentResult[0];
    let brandVoice = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 CONTESTO BUSINESS (di cosa ti occupi)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (agent.businessName) brandVoice += `• Business: ${agent.businessName}\n`;
    if (agent.businessDescription) brandVoice += `• Descrizione: ${agent.businessDescription}\n`;
    if (agent.whatWeDo) brandVoice += `• Cosa facciamo: ${agent.whatWeDo}\n`;
    if (agent.howWeDoIt) brandVoice += `• Come lo facciamo: ${agent.howWeDoIt}\n`;
    if (agent.whoWeHelp) brandVoice += `• Chi aiutiamo: ${agent.whoWeHelp}\n`;
    if (agent.usp) brandVoice += `• USP: ${agent.usp}\n`;
    
    if (agent.servicesOffered) {
      try {
        const services = typeof agent.servicesOffered === 'string' ? JSON.parse(agent.servicesOffered) : agent.servicesOffered;
        if (Array.isArray(services) && services.length > 0) {
          brandVoice += `• Servizi:\n`;
          services.slice(0, 5).forEach((s: any) => {
            if (typeof s === 'string') {
              brandVoice += `  - ${s}\n`;
            } else {
              brandVoice += `  - ${s.name || s}${s.price ? ` (${s.price})` : ''}\n`;
            }
          });
        }
      } catch {}
    }
    
    brandVoiceCache.set(agentId, { text: brandVoice, timestamp: Date.now() });
    console.log(`🏢 [BrandVoice] Cache MISS → loaded from DB (${brandVoice.length} chars)`);
    return brandVoice;
  } catch (err) {
    console.error('Error building brand voice:', err);
    return '';
  }
}

function buildDetailedProfileSection(dp: any): string {
  if (!dp) return '';

  const fields: Array<{ label: string; key: string }> = [
    { label: 'Titolo', key: 'professionalTitle' },
    { label: 'Tagline', key: 'tagline' },
    { label: 'Bio', key: 'bio' },
    { label: 'Anni di esperienza', key: 'yearsOfExperience' },
    { label: 'Certificazioni', key: 'certifications' },
    { label: 'Formazione', key: 'education' },
    { label: 'Lingue parlate', key: 'languagesSpoken' },
    { label: 'Business', key: 'businessName' },
    { label: 'Tipo business', key: 'businessType' },
    { label: 'P.IVA', key: 'vatNumber' },
    { label: 'Indirizzo', key: 'businessAddress' },
    { label: 'Sito web', key: 'websiteUrl' },
    { label: 'LinkedIn', key: 'linkedinUrl' },
    { label: 'Instagram', key: 'instagramUrl' },
    { label: 'Servizi', key: 'servicesOffered' },
    { label: 'Specializzazioni', key: 'specializations' },
    { label: 'Metodologia', key: 'methodology' },
    { label: 'Strumenti', key: 'toolsUsed' },
    { label: 'Cliente ideale', key: 'idealClientDescription' },
    { label: 'Settori', key: 'industriesServed' },
    { label: 'Fascia età clienti', key: 'clientAgeRange' },
    { label: 'Focus geografico', key: 'geographicFocus' },
    { label: 'Stile consulenza', key: 'consultationStyle' },
    { label: 'Processo iniziale', key: 'initialProcess' },
    { label: 'Durata sessione', key: 'sessionDuration' },
    { label: 'Approccio follow-up', key: 'followUpApproach' },
    { label: 'Valori', key: 'coreValues' },
    { label: 'Mission', key: 'missionStatement' },
    { label: 'Vision', key: 'visionStatement' },
    { label: 'USP', key: 'uniqueSellingProposition' },
    { label: '⚙️ Tono di voce', key: 'toneOfVoice' },
    { label: '📝 Contesto aggiuntivo', key: 'additionalContext' },
    { label: '🚫 Argomenti da evitare', key: 'topicsToAvoid' },
  ];

  const lines: string[] = [];
  for (const f of fields) {
    const val = dp[f.key];
    if (val !== null && val !== undefined && val !== '') {
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (strVal.trim()) {
        lines.push(`${f.label}: ${strVal}`);
      }
    }
  }

  if (lines.length === 0) return '';

  return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PROFILO DETTAGLIATO DEL CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${lines.join('\n')}
`;
}

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

interface ActiveVoiceCall {
  id: string;
  callerId: string;
  consultantId: string;
  clientId: string | null;
  startedAt: Date;
  status: string;
}

const activeSessionsCache = new Map<string, ActiveSessionEntry>();
const activeVoiceCalls = new Map<string, ActiveVoiceCall>();
(globalThis as any).__geminiLiveService = { activeVoiceCalls };
const SESSION_TTL_MS = 3 * 60 * 1000; // 3 minuti

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🔌 GEMINI WEBSOCKET CONNECTION TRACKER
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Tracks all active WebSocket connections to Gemini to:
 * - Prevent resource exhaustion from zombie connections
 * - Enable monitoring via API endpoint
 * - Allow force-kill of stale connections
 */
interface ActiveGeminiConnection {
  connectionId: string;
  mode: string;
  startedAt: Date;
  lastActivity: Date;
  status: 'connecting' | 'active' | 'reconnecting' | 'closing';
  retryCount: number;
  websocket: WebSocket | null;
  callerWebsocket?: WebSocket | null;
  consultantId?: string;
  callId?: string;
  clientId?: string;
}

// 🆕 P0.1 - Costanti per timeout anti-zombie
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;        // 30 minuti senza attività → kill
const MAX_SESSION_DURATION_MS = 2 * 60 * 60 * 1000;  // 2 ore max sessione → kill

async function fetchVpsFreeswitchCalls(): Promise<{ callerIds: Set<string>, calledNumbers: Set<string>, rawCalls: any[] } | null> {
  try {
    const globalVoiceResult = await db.execute(sql`
      SELECT vps_bridge_url, service_token FROM superadmin_voice_config WHERE id = 'default' AND enabled = true LIMIT 1
    `);
    const globalVoice = globalVoiceResult.rows[0] as any;
    const vpsUrl = globalVoice?.vps_bridge_url || process.env.VPS_BRIDGE_URL;
    const vpsToken = globalVoice?.service_token;
    if (!vpsUrl) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${vpsUrl}/health`, {
      signal: controller.signal,
      headers: vpsToken ? { 'Authorization': `Bearer ${vpsToken}` } : {},
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const health = await res.json();
    const fsCalls: any[] = health.freeswitchCalls || [];
    const callerIds = new Set<string>();
    const calledNumbers = new Set<string>();
    for (const c of fsCalls) {
      if (c.cid_num) callerIds.add(c.cid_num);
      if (c.dest) calledNumbers.add(c.dest);
      if (c.callee_num) calledNumbers.add(c.callee_num);
    }
    return { callerIds, calledNumbers, rawCalls: fsCalls };
  } catch (err: any) {
    console.warn(`⚠️ [VPS-HEALTH] Could not fetch FreeSWITCH calls: ${err.message}`);
    return null;
  }
}

async function cleanOrphanVoiceCalls(consultantId?: string): Promise<number> {
  try {
    const whereConsultant = consultantId 
      ? sql`AND vc.consultant_id = ${consultantId}`
      : sql``;
    const talkingCalls = await db.execute(sql`
      SELECT vc.id, vc.caller_id, vc.called_number, vc.call_direction, vc.started_at, vc.updated_at
      FROM voice_calls vc
      WHERE vc.status IN ('talking', 'ringing')
        AND vc.updated_at < NOW() - INTERVAL '2 minutes'
        ${whereConsultant}
    `);
    
    if (talkingCalls.rows.length === 0) return 0;

    const hasGeminiStream = (callId: string, callerId: string, calledNumber: string): boolean => {
      for (const [, conn] of activeGeminiConnections.entries()) {
        if (conn.callId === callId) return true;
      }
      for (const [vcId, vc] of activeVoiceCalls.entries()) {
        if (vcId === callId) return true;
        if (callerId && vc.callerId === callerId) return true;
        if (calledNumber && vc.calledNumber === calledNumber) return true;
      }
      return false;
    };

    const candidatesWithoutStream = (talkingCalls.rows as any[]).filter(c => 
      !hasGeminiStream(c.id, c.caller_id || '', c.called_number || '')
    );

    if (candidatesWithoutStream.length === 0) return 0;

    const vpsData = await fetchVpsFreeswitchCalls();

    let cleaned = 0;
    for (const call of candidatesWithoutStream) {
      let isOnFreeSWITCH = false;

      if (vpsData) {
        const cid = call.caller_id || '';
        const dest = call.called_number || '';
        isOnFreeSWITCH = vpsData.callerIds.has(cid) || vpsData.calledNumbers.has(dest) ||
                         vpsData.callerIds.has(dest) || vpsData.calledNumbers.has(cid);
      } else {
        continue;
      }

      if (!isOnFreeSWITCH) {
        const ageSeconds = Math.round((Date.now() - new Date(call.updated_at).getTime()) / 1000);
        const startedAt = call.started_at ? new Date(call.started_at) : new Date();
        const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
        console.log(`🧹 [ORPHAN-CLEANUP] voice_call ${call.id} status=talking for ${ageSeconds}s, NO Gemini stream, NOT on FreeSWITCH → marking completed`);
        
        const orphanMeta = JSON.stringify({
          orphanCleanup: true,
          cleanedAt: new Date().toISOString(),
          reason: 'no_gemini_stream_no_freeswitch',
          ageSeconds,
          originalStatus: 'talking',
        });
        
        await db.execute(sql`
          UPDATE voice_calls
          SET status = 'completed', 
              ended_at = NOW(),
              duration_seconds = ${durationSeconds},
              outcome = 'orphan_cleanup',
              metadata = COALESCE(metadata, '{}'::jsonb) || ${orphanMeta}::jsonb,
              updated_at = NOW()
          WHERE id = ${call.id} AND status IN ('talking', 'ringing')
        `);
        cleaned++;
      }
    }
    
    return cleaned;
  } catch (err: any) {
    console.warn(`⚠️ [ORPHAN-CLEANUP] Error: ${err.message}`);
    return 0;
  }
}
const HEARTBEAT_TIMEOUT_MS = 60 * 1000;        // 60s senza heartbeat → kill

/**
 * 🆕 P0.1 - Aggiorna lastActivity nel tracker
 * Chiamata su: audio chunk, text event, heartbeat
 */
function updateConnectionActivity(connectionId: string): void {
  const conn = activeGeminiConnections.get(connectionId);
  if (conn) {
    conn.lastActivity = new Date();
  }
}

const activeGeminiConnections = new Map<string, ActiveGeminiConnection>();

export function getActiveGeminiConnections(): ActiveGeminiConnection[] {
  return Array.from(activeGeminiConnections.values()).map(conn => ({
    ...conn,
    websocket: null // Don't expose WebSocket object
  }));
}

export function getActiveGeminiConnectionCount(): number {
  return activeGeminiConnections.size;
}

export function forceCloseAllGeminiConnections(): { closed: number; errors: string[] } {
  const errors: string[] = [];
  let closed = 0;
  
  console.log(`\n🔴 [FORCE CLOSE] Killing ${activeGeminiConnections.size} Gemini connections...`);
  
  for (const [connId, conn] of activeGeminiConnections.entries()) {
    try {
      if (conn.websocket) {
        // 🆕 P0.4 - Usa terminate() per chiusura HARD (evita socket half-open)
        if (typeof (conn.websocket as any).terminate === 'function') {
          (conn.websocket as any).terminate();
          closed++;
          console.log(`   ✅ Terminated: ${connId}`);
        } else if (conn.websocket.readyState === WebSocket.OPEN) {
          conn.websocket.close(1000, 'Force closed by admin');
          closed++;
          console.log(`   ✅ Closed: ${connId}`);
        } else {
          console.log(`   ⚠️  Already closed: ${connId}`);
        }
      } else {
        console.log(`   ⚠️  No websocket: ${connId}`);
      }
      activeGeminiConnections.delete(connId);
    } catch (err: any) {
      errors.push(`${connId}: ${err.message}`);
      console.log(`   ❌ Error closing ${connId}: ${err.message}`);
    }
  }
  
  console.log(`🔴 [FORCE CLOSE] Done. Closed: ${closed}, Errors: ${errors.length}\n`);
  return { closed, errors };
}

// 🆕 P0.1 - Logging migliorato con lastActivity e durata inattività
// 🔍 TEMP DEBUG: Log ogni 15s SEMPRE (anche quando 0) per verificare cleanup post-chiamata
setInterval(() => {
  const count = activeGeminiConnections.size;
  console.log(`🔌 [GEMINI TRACKER] ACTIVE GEMINI STREAMS: ${count}`);
  if (count > 0) {
    const now = Date.now();
    for (const [connId, conn] of activeGeminiConnections.entries()) {
      const durationSec = Math.round((now - conn.startedAt.getTime()) / 1000);
      const idleSec = Math.round((now - conn.lastActivity.getTime()) / 1000);
      const durationMin = Math.round(durationSec / 60);
      const idleMin = Math.round(idleSec / 60);
      console.log(`   • ${connId}: ${conn.mode} - ${conn.status} - durata: ${durationMin}min - idle: ${idleMin}min - retries: ${conn.retryCount}`);
    }
  }
}, 15 * 1000);

/**
 * 🆕 P0.2 - GARBAGE COLLECTOR ANTI-ZOMBIE
 * Ogni 60 secondi controlla tutte le connessioni e chiude:
 * - Quelle inattive da più di 30 minuti (IDLE_TIMEOUT_MS)
 * - Quelle attive da più di 2 ore (MAX_SESSION_DURATION_MS)
 */
setInterval(() => {
  const now = Date.now();
  let killedByIdle = 0;
  let killedByMaxDuration = 0;
  
  for (const [connId, conn] of activeGeminiConnections.entries()) {
    const idleMs = now - conn.lastActivity.getTime();
    const durationMs = now - conn.startedAt.getTime();
    
    // 🔴 IDLE TIMEOUT: 30 minuti senza attività
    if (idleMs > IDLE_TIMEOUT_MS) {
      console.log(`\n🧹 [ZOMBIE KILLER] Connection ${connId} IDLE for ${Math.round(idleMs / 60000)}min → TERMINATING`);
      forceCloseConnection(connId, 'idle_timeout');
      killedByIdle++;
      continue;
    }
    
    // 🔴 MAX SESSION DURATION: 2 ore massimo
    if (durationMs > MAX_SESSION_DURATION_MS) {
      console.log(`\n🧹 [ZOMBIE KILLER] Connection ${connId} running for ${Math.round(durationMs / 3600000)}h → TERMINATING (max session)`);
      forceCloseConnection(connId, 'max_session_reached');
      killedByMaxDuration++;
      continue;
    }
    
    // ⚠️ WARNING: sessione vicina al limite (1h50 = 110 minuti)
    if (durationMs > MAX_SESSION_DURATION_MS - 10 * 60 * 1000) {
      const remainingMin = Math.round((MAX_SESSION_DURATION_MS - durationMs) / 60000);
      console.log(`⚠️  [SESSION WARNING] ${connId} will be terminated in ${remainingMin} minutes`);
    }
  }
  
  if (killedByIdle > 0 || killedByMaxDuration > 0) {
    console.log(`🧹 [ZOMBIE KILLER] Cleanup complete: ${killedByIdle} idle, ${killedByMaxDuration} max duration`);
  }

  cleanOrphanVoiceCalls().then(cleaned => {
    if (cleaned > 0) {
      console.log(`🧹 [ORPHAN-GC] Cleaned ${cleaned} orphan voice_calls (no Gemini stream, not on FreeSWITCH)`);
    }
  }).catch(() => {});
}, 60 * 1000);

/**
 * 🆕 P0.2/P0.4 - Chiude forzatamente una singola connessione
 * Usa terminate() per evitare socket half-open
 */
function forceCloseConnection(connectionId: string, reason: string): void {
  const conn = activeGeminiConnections.get(connectionId);
  if (!conn) return;
  
  try {
    if (conn.websocket) {
      if (typeof (conn.websocket as any).terminate === 'function') {
        (conn.websocket as any).terminate();
      } else {
        conn.websocket.close(1000, reason);
      }
    }
    if (conn.callerWebsocket) {
      console.log(`   🔌 [${connectionId}] Also closing caller/VPS WebSocket (triggers FreeSWITCH uuid_kill)`);
      try {
        if (typeof (conn.callerWebsocket as any).terminate === 'function') {
          (conn.callerWebsocket as any).terminate();
        } else {
          conn.callerWebsocket.close(1000, reason);
        }
      } catch (callerErr: any) {
        console.warn(`   ⚠️ [${connectionId}] Failed to close caller WS: ${callerErr.message}`);
      }
    }
    activeGeminiConnections.delete(connectionId);
    console.log(`   ✅ [${connectionId}] Terminated: ${reason}`);
  } catch (err: any) {
    console.error(`   ❌ [${connectionId}] Failed to terminate: ${err.message}`);
    activeGeminiConnections.delete(connectionId);
  }
}

// Export function to get active voice calls
export function getActiveVoiceCalls(): ActiveVoiceCall[] {
  return Array.from(activeVoiceCalls.values());
}

export function getActiveVoiceCallsForConsultant(consultantId: string): ActiveVoiceCall[] {
  return Array.from(activeVoiceCalls.values()).filter(call => call.consultantId === consultantId);
}

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
      const cleanedContent = msg.role === 'assistant' ? stripAiThinking(msg.content) : msg.content;
      const transformed = {
        role: msg.role as 'user' | 'assistant',
        content: cleanedContent,
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 FORMATO FEEDBACK COMPATTO (90-110 token, singola riga)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Output: una frase fluida in italiano con Performance + Tono + Archetipo
// Esempio: "Buon rapport costruito, riprendi controllo con domanda mirata. 
//           Tono OK, evita ripetere 'interessante'. Prospect scettico: usa prove concrete."
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CheckpointItemDetail {
  check: string;
  status: 'validated' | 'missing' | 'vague';
  infoCollected?: string;
  reason?: string;
  evidenceQuote?: string;
  suggestedNextAction?: string;
}

interface CompactFeedbackParams {
  feedbackType: string;
  feedbackPriority: string;
  doingWell: string;
  needsImprovement: string;
  toneReminder: string;
  archetypeState?: { current: string; confidence: number; aiIntuition?: string } | null;
  toneAnalysis?: { isRobotic: boolean; consecutiveQuestions: number; energyMismatch: boolean } | null;
  stepResult?: { shouldAdvance: boolean } | null;
  checkpointItemDetails?: CheckpointItemDetail[] | null;
  currentObjective?: string | null; // 🆕 Obiettivo della fase corrente
  aiIntuition?: string | null; // 🆕 AI Intuition dal checkpoint
  aiSuggestion?: string | null; // 🆕 Suggerimento AI dal checkpoint
}

function formatCompactFeedback(params: CompactFeedbackParams): string {
  // 🔧 LASER FOCUS: Solo AZIONE + ARCHETIPO + TONO (niente OBIETTIVO = -60% token)
  // L'agente esegue UN comando alla volta = risultato più naturale
  
  const lines: string[] = [];
  
  // 1. 💬 AZIONE SPECIFICA - La cosa da fare ORA (singola, chiara)
  if (params.needsImprovement && params.needsImprovement.length > 10) {
    const cleanAction = params.needsImprovement
      .replace(/🎯\s*PROSSIMI\s*PASSI:?\s*/gi, '')
      .replace(/→\s*/g, '')
      .trim();
    if (cleanAction.length > 10 && cleanAction !== 'Continua a seguire lo script') {
      lines.push(`💬 AZIONE: ${cleanAction}`);
    }
  }
  
  // 2. 🧠 ARCHETIPO (AI Intuition o stato corrente)
  const archetype = params.aiIntuition || params.archetypeState?.current;
  if (archetype && archetype.length > 0 && archetype !== 'neutral') {
    lines.push(`🧠 ARCHETIPO: ${archetype}`);
  }
  
  // 3. 🎵 TONO (come parlare)
  if (params.toneReminder && params.toneReminder.length > 5) {
    const cleanTone = params.toneReminder
      .replace(/Tono:\s*/gi, '')
      .replace(/Adatta il tuo stile a/gi, '')
      .trim();
    if (cleanTone.length > 5) {
      lines.push(`🎵 TONO: ${cleanTone}`);
    }
  }
  
  // Unisci tutto su righe separate
  let feedback = lines.join('\n');
  
  // FALLBACK se vuoto
  if (!feedback || feedback.length < 10) {
    feedback = 'Continua la conversazione in modo naturale.';
  }
  
  console.log(`   📊 [LASER FOCUS] Feedback compatto (${feedback.length} chars, ${lines.length} sezioni)`);
  
  return feedback;
}

function getStrengthFromParams(params: CompactFeedbackParams): string {
  const { doingWell, feedbackType } = params;
  
  if (doingWell.includes('rapport') || doingWell.includes('relazione')) {
    return 'Buon rapport costruito';
  }
  if (doingWell.includes('tono') || doingWell.includes('Tono')) {
    return 'Conversazione fluida';
  }
  if (feedbackType === 'buy_signal') {
    return 'Segnali positivi rilevati';
  }
  if (doingWell.length > 0 && doingWell !== 'Stai seguendo lo script') {
    return doingWell.substring(0, 50);
  }
  return 'Stai procedendo bene';
}

function getWeaknessFromParams(params: CompactFeedbackParams): string {
  const { needsImprovement, feedbackType, feedbackPriority } = params;
  
  if (feedbackType === 'control_loss') {
    return 'riprendi controllo con domanda mirata';
  }
  if (feedbackType === 'out_of_scope') {
    return 'guida verso i servizi che offri';
  }
  if (params.toneAnalysis?.consecutiveQuestions && params.toneAnalysis.consecutiveQuestions > 2) {
    return 'troppe domande consecutive, aspetta risposta';
  }
  if (feedbackPriority === 'critical' || feedbackPriority === 'high') {
    // Estrai azione dal needsImprovement
    const action = needsImprovement.split('\n')[0]
      .replace(/^[⚠️🎯→●•]\s*/g, '')
      .substring(0, 60);
    if (action.length > 10) return action;
  }
  if (needsImprovement.includes('approfond')) {
    return 'approfondisci prima di procedere';
  }
  return '';
}

function getToneNote(toneAnalysis: CompactFeedbackParams['toneAnalysis'], toneReminder: string): string {
  if (!toneAnalysis) return 'Tono adeguato';
  
  const issues: string[] = [];
  
  if (toneAnalysis.energyMismatch) {
    issues.push('aumenta energia');
  }
  if (toneAnalysis.isRobotic) {
    issues.push('sii più naturale');
  }
  
  // Estrai suggerimento dal toneReminder se presente
  if (toneReminder && toneReminder.length > 0) {
    const cleanReminder = toneReminder
      .replace(/^Ricorda:\s*/i, '')
      .replace(/^Tono\s*/i, '')
      .substring(0, 40);
    if (cleanReminder.length > 5 && !issues.includes(cleanReminder)) {
      issues.push(cleanReminder);
    }
  }
  
  if (issues.length === 0) return 'Tono OK';
  return 'Tono: ' + issues.slice(0, 2).join(', ');
}

function getArchetypeNote(archetypeState: CompactFeedbackParams['archetypeState']): string {
  if (!archetypeState || archetypeState.current === 'neutral') return '';
  
  const archetype = archetypeState.current.toLowerCase();
  // 🔧 FIX: Restituisce SOLO il tono, NON l'azione (che deve essere dinamica dall'AI)
  const tones: Record<string, string> = {
    'skeptic': 'Tono: 🤔 RASSICURANTE',
    'busy': 'Tono: ⚡ DIRETTO',
    'price_focused': 'Tono: 💎 VALORIZZANTE',
    'enthusiast': 'Tono: 😊 ENTUSIASTA',
    'indecisive': 'Tono: 🤝 SUPPORTIVO',
    'defensive': 'Tono: 💚 EMPATICO',
    'technical': 'Tono: 📊 PRECISO'
  };
  
  return tones[archetype] || '';
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
  // Test mode for AI Trainer (discovery | demo | discovery_demo)
  testMode: 'discovery' | 'demo' | 'discovery_demo' | null;
  // Phone call specific fields
  phoneCallLeadContext?: string | null;
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
    const voiceName = url.searchParams.get('voice') || 'Kore';
    const resumeHandle = url.searchParams.get('resumeHandle');
    const sessionType = url.searchParams.get('sessionType');
    const testModeParam = url.searchParams.get('testMode');
    const testMode = (testModeParam === 'discovery' || testModeParam === 'demo' || testModeParam === 'discovery_demo') 
      ? testModeParam 
      : null;

    if (mode === 'warmup') {
      return null;
    }

    if (!mode) {
      console.error('❌ No mode provided in WebSocket connection');
      return null;
    }

    // Validate mode
    if (mode !== 'assistenza' && mode !== 'consulente' && mode !== 'sales_agent' && mode !== 'consultation_invite' && mode !== 'phone_service') {
      console.error('❌ Invalid mode provided. Must be "assistenza", "consulente", "sales_agent", "consultation_invite", or "phone_service"');
      return null;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PHONE SERVICE MODE - VPS Voice Bridge authenticated sessions
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (mode === 'phone_service') {
      if (!token) {
        console.error('❌ No service token provided for phone_service mode');
        return null;
      }

      const callerId = url.searchParams.get('callerId');
      const calledNumber = url.searchParams.get('calledNumber');
      const scheduledCallIdParam = url.searchParams.get('scheduledCallId');
      const voiceCallIdParam = url.searchParams.get('voiceCallId');
      const fsUuidParam = url.searchParams.get('fsUuid');
      if (!callerId) {
        console.error('❌ No callerId provided for phone_service mode');
        return null;
      }

      try {
        const authPhaseStart = Date.now();
        const jwtDecodeStart = Date.now();
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        console.log(`⏱️ [AUTH-DETAIL] JWT verify: ${Date.now() - jwtDecodeStart}ms`);

        if (decoded.type !== 'phone_service') {
          console.error('❌ Invalid token type. Must be phone_service');
          return null;
        }

        if (!decoded.consultantId) {
          console.error('❌ Invalid phone_service token: missing consultantId');
          return null;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // MULTI-TENANT NUMBER LOOKUP: calledNumber → consultant routing
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 [ROUTING-DEBUG] JWT DECODED in WebSocket auth:`);
        console.log(`🔍 [ROUTING-DEBUG]   decoded.consultantId: ${decoded.consultantId}`);
        console.log(`🔍 [ROUTING-DEBUG]   decoded.type: ${decoded.type}`);
        console.log(`🔍 [ROUTING-DEBUG]   decoded.scope: ${decoded.scope || 'N/A'}`);
        console.log(`🔍 [ROUTING-DEBUG]   calledNumber: ${calledNumber || 'N/A'}`);
        console.log(`🔍 [ROUTING-DEBUG]   callerId: ${callerId || 'N/A'}`);
        console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        let resolvedConsultantId = decoded.consultantId;
        let resolvedCalledNumber = calledNumber || '9999';
        let numberConfig: any = null;

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // OUTBOUND CALL FIX: For outbound calls, the scheduledCallId contains
        // the REAL consultant_id (set by the authenticated user who triggered the call).
        // The global VPS token may contain a different consultant's ID, so we must
        // resolve the correct consultant from the scheduled_voice_calls record FIRST,
        // before voice_numbers lookup can override it with the wrong consultant.
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let _cachedScheduledCallRow: any = null;
        if (scheduledCallIdParam) {
          const scLookupStart = Date.now();
          try {
            const scResult = await db.execute(sql`
              SELECT consultant_id, target_phone, id, call_instruction, instruction_type, status
              FROM scheduled_voice_calls 
              WHERE id = ${scheduledCallIdParam} LIMIT 1
            `);
            if (scResult.rows.length > 0) _cachedScheduledCallRow = scResult.rows[0];
            console.log(`⏱️ [AUTH-DETAIL] scheduledCall consultant lookup: ${Date.now() - scLookupStart}ms`);
            
            if (scResult.rows.length > 0) {
              const realConsultantId = (scResult.rows[0] as any).consultant_id;
              console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🔍 [ROUTING-DEBUG] OUTBOUND CONSULTANT OVERRIDE from scheduled_voice_calls:`);
              console.log(`🔍 [ROUTING-DEBUG]   scheduledCallId: ${scheduledCallIdParam}`);
              console.log(`🔍 [ROUTING-DEBUG]   JWT consultantId: ${decoded.consultantId}`);
              console.log(`🔍 [ROUTING-DEBUG]   DB consultant_id (REAL): ${realConsultantId}`);
              console.log(`🔍 [ROUTING-DEBUG]   target_phone: ${(scResult.rows[0] as any).target_phone}`);
              
              if (realConsultantId !== decoded.consultantId) {
                console.log(`🔍 [ROUTING-DEBUG]   ⚠️ MISMATCH! JWT has ${decoded.consultantId} but call belongs to ${realConsultantId}`);
                console.log(`🔍 [ROUTING-DEBUG]   ✅ OVERRIDING resolvedConsultantId → ${realConsultantId} (from DB, trusted source)`);
                
                // Verify the token is authorized (global platform token)
                const isAuthorizedToken = await db.execute(sql`
                  SELECT 1 FROM superadmin_voice_config 
                  WHERE id = 'default' AND enabled = true AND service_token = ${token} LIMIT 1
                `);
                if (isAuthorizedToken.rows.length === 0 && decoded.scope !== 'platform') {
                  console.error(`❌ [PHONE SERVICE] Token is not global/platform and consultantId mismatches → REJECTING`);
                  return null;
                }
                console.log(`🔍 [ROUTING-DEBUG]   ✅ Token authorized (global/platform) for cross-consultant outbound`);
              }
              
              resolvedConsultantId = realConsultantId;
              console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            } else {
              console.error(`❌ [ROUTING-DEBUG] scheduledCallId ${scheduledCallIdParam} not found in DB → REJECTING outbound call to prevent misrouting`);
              return null;
            }
          } catch (err: any) {
            console.error(`❌ [ROUTING-DEBUG] Failed to lookup scheduledCall consultant: ${err.message} → REJECTING outbound call`);
            return null;
          }
        }

        if (calledNumber) {
          const { normalizePhoneNumber: normalizeCalledE164 } = await import('../routes/lead-import-router');
          const e164Called = normalizeCalledE164(calledNumber.replace(/\s+/g, ''));
          let normalizedCalledNumber = e164Called || calledNumber.replace(/\s+/g, '').replace(/^00/, '+');
          resolvedCalledNumber = normalizedCalledNumber;

          const rejectedEntry = _rejectedNumbersCache.get(normalizedCalledNumber);
          if (rejectedEntry && Date.now() - rejectedEntry.ts < REJECTED_CACHE_TTL) {
            rejectedEntry.count++;
            if (rejectedEntry.count <= REJECTED_MAX_LOG) {
              console.error(`❌ [PHONE SERVICE] Called number ${normalizedCalledNumber} rejected (cached, attempt ${rejectedEntry.count}) — suppressing further logs`);
            }
            return null;
          }

          const lookupStart = Date.now();
          
          const cachedNumber = getCached(_voiceNumbersCache, normalizedCalledNumber);
          let numberRows: any;
          if (cachedNumber) {
            numberRows = { rows: [cachedNumber] };
            console.log(`⏱️ [AUTH-DETAIL] voice_numbers CACHE HIT: ${Date.now() - lookupStart}ms`);
          } else {
            const withPlus = normalizedCalledNumber.startsWith('+') ? normalizedCalledNumber : '+' + normalizedCalledNumber;
            const withoutPlus = normalizedCalledNumber.startsWith('+') ? normalizedCalledNumber.slice(1) : normalizedCalledNumber;
            numberRows = await db.execute(sql`
              SELECT id, phone_number, display_name, consultant_id, ai_mode, 
                     max_concurrent_calls, is_active, greeting_text, voice_id
              FROM voice_numbers 
              WHERE (phone_number = ${normalizedCalledNumber} OR phone_number = ${withPlus} OR phone_number = ${withoutPlus}) AND is_active = true
              LIMIT 1
            `);
            if (numberRows.rows.length > 0) {
              _voiceNumbersCache.set(normalizedCalledNumber, { data: numberRows.rows[0], ts: Date.now() });
            }
            console.log(`⏱️ [AUTH-DETAIL] voice_numbers lookup: ${Date.now() - lookupStart}ms (tried: ${normalizedCalledNumber}, ${withPlus}, ${withoutPlus})`);
          }

          if (numberRows.rows.length === 0) {
            const isOutboundCall = voiceCallIdParam?.startsWith('outbound-');
            if (scheduledCallIdParam && _cachedScheduledCallRow) {
              console.log(`⚠️ [PHONE SERVICE] calledNumber ${normalizedCalledNumber} not in voice_numbers — OUTBOUND call allowed (consultant ${resolvedConsultantId} resolved from scheduled_voice_calls)`);
            } else if (isOutboundCall) {
              console.log(`⚠️ [PHONE SERVICE] calledNumber ${normalizedCalledNumber} not in voice_numbers — OUTBOUND callback allowed (voiceCallId=${voiceCallIdParam}, consultant ${resolvedConsultantId} from JWT)`);
            } else {
              const fallbackResult = await db.execute(sql`
                SELECT DISTINCT consultant_id FROM voice_numbers WHERE is_active = true AND consultant_id IS NOT NULL LIMIT 1
              `);
              if (fallbackResult.rows.length > 0) {
                resolvedConsultantId = (fallbackResult.rows[0] as any).consultant_id;
                console.log(`⚠️ [PHONE SERVICE] calledNumber ${normalizedCalledNumber} not in voice_numbers — INBOUND FALLBACK to first active consultant ${resolvedConsultantId}`);
              } else {
                console.error(`❌ [PHONE SERVICE] Called number ${normalizedCalledNumber} not found or inactive in voice_numbers → REJECTING CALL`);
                _rejectedNumbersCache.set(normalizedCalledNumber, { count: 1, ts: Date.now() });
                return null;
              }
            }
          }

          if (numberRows.rows.length > 0) {
            numberConfig = numberRows.rows[0] as any;
            console.log(`🔍 [ROUTING-DEBUG] voice_numbers lookup result:`);
            console.log(`🔍 [ROUTING-DEBUG]   BEFORE: resolvedConsultantId = ${resolvedConsultantId}`);
            console.log(`🔍 [ROUTING-DEBUG]   voice_numbers.consultant_id = ${numberConfig.consultant_id}`);
            
            if (scheduledCallIdParam && resolvedConsultantId !== numberConfig.consultant_id) {
              console.log(`🔍 [ROUTING-DEBUG]   ⏭️ SKIPPING voice_numbers override for OUTBOUND call`);
              console.log(`🔍 [ROUTING-DEBUG]   Keeping resolvedConsultantId = ${resolvedConsultantId} (from scheduled_voice_calls)`);
              console.log(`🔍 [ROUTING-DEBUG]   voice_numbers would have set: ${numberConfig.consultant_id} (IGNORED for outbound)`);
            } else {
              resolvedConsultantId = numberConfig.consultant_id;
              console.log(`🔍 [ROUTING-DEBUG]   AFTER: resolvedConsultantId = ${resolvedConsultantId}`);
            }
            console.log(`✅ [PHONE SERVICE] Number ${normalizedCalledNumber} → consultant ${resolvedConsultantId} (${numberConfig.display_name || 'unnamed'})`);

            console.log(`🔍 [ROUTING-DEBUG] Cross-consultant token check:`);
            console.log(`🔍 [ROUTING-DEBUG]   decoded.consultantId (from JWT): ${decoded.consultantId}`);
            console.log(`🔍 [ROUTING-DEBUG]   resolvedConsultantId (from voice_numbers): ${resolvedConsultantId}`);
            console.log(`🔍 [ROUTING-DEBUG]   decoded.scope: ${decoded.scope || 'N/A'}`);
            console.log(`🔍 [ROUTING-DEBUG]   match? ${decoded.consultantId === resolvedConsultantId}`);
            if (decoded.consultantId !== resolvedConsultantId && decoded.scope !== 'platform') {
              console.log(`🔍 [ROUTING-DEBUG]   ⚠️ MISMATCH detected! JWT consultant ≠ number consultant. Checking global token...`);
              const isGlobalToken = await db.execute(sql`
                SELECT 1 FROM superadmin_voice_config WHERE id = 'default' AND enabled = true AND service_token = ${token} LIMIT 1
              `);
              if (isGlobalToken.rows.length === 0) {
                console.error(`❌ [PHONE SERVICE] Token consultant ${decoded.consultantId} ≠ number consultant ${resolvedConsultantId} and not a platform/global token → REJECTING`);
                return null;
              }
              console.log(`🔍 [ROUTING-DEBUG]   ✅ Global token confirmed. Using resolvedConsultantId=${resolvedConsultantId} (overridden from JWT's ${decoded.consultantId})`);
              console.log(`✅ [PHONE SERVICE] Global superadmin token accepted for cross-consultant routing`);
            }
          }

          const channelCheckStart = Date.now();
          const maxChannels = numberConfig?.max_concurrent_calls || 5;
          console.log(`📊 [CHANNEL-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📊 [CHANNEL-CHECK] Checking channels for number=${resolvedCalledNumber} consultant=${resolvedConsultantId?.slice(0,8)}... maxChannels=${maxChannels}`);
          console.log(`📊 [CHANNEL-CHECK] Query: status='talking' AND (called_number='${resolvedCalledNumber}' OR caller_id='${resolvedCalledNumber}' OR svc.from_number='${resolvedCalledNumber}')`);
          const activeCallsResult = await db.execute(sql`
            SELECT COUNT(DISTINCT vc.id) as active_count 
            FROM voice_calls vc
            LEFT JOIN scheduled_voice_calls svc ON svc.voice_call_id = vc.id
            WHERE vc.consultant_id = ${resolvedConsultantId} AND vc.status = 'talking'
              AND (
                vc.called_number = ${resolvedCalledNumber}
                OR vc.caller_id = ${resolvedCalledNumber}
                OR svc.from_number = ${resolvedCalledNumber}
              )
          `);
          const activeCount = parseInt((activeCallsResult.rows[0] as any)?.active_count || '0', 10);

          console.log(`📊 [CHANNEL-CHECK] Result: activeCount(talking)=${activeCount}/${maxChannels} for ${resolvedCalledNumber}`);
          console.log(`⏱️ [AUTH-DETAIL] Channel check: ${Date.now() - channelCheckStart}ms (active: ${activeCount}/${maxChannels}, number: ${resolvedCalledNumber})`);

          if (activeCount >= maxChannels) {
            console.log(`📊 [CHANNEL-CHECK] Channels appear full (${activeCount}/${maxChannels}) — checking for orphan calls...`);
            
            const cleanedOrphans = await cleanOrphanVoiceCalls(resolvedConsultantId!);
            
            if (cleanedOrphans > 0) {
              console.log(`🧹 [CHANNEL-CHECK] Cleaned ${cleanedOrphans} orphan calls — rechecking channels...`);
              const recheckResult = await db.execute(sql`
                SELECT COUNT(DISTINCT vc.id) as active_count 
                FROM voice_calls vc
                LEFT JOIN scheduled_voice_calls svc ON svc.voice_call_id = vc.id
                WHERE vc.consultant_id = ${resolvedConsultantId} AND vc.status = 'talking'
                  AND (
                    vc.called_number = ${resolvedCalledNumber}
                    OR vc.caller_id = ${resolvedCalledNumber}
                    OR svc.from_number = ${resolvedCalledNumber}
                  )
              `);
              const newActiveCount = parseInt((recheckResult.rows[0] as any)?.active_count || '0', 10);
              console.log(`📊 [CHANNEL-CHECK] After orphan cleanup: ${newActiveCount}/${maxChannels} channels in use`);
              
              if (newActiveCount < maxChannels) {
                console.log(`✅ [CHANNEL-CHECK] Channels freed after orphan cleanup — ALLOWING call`);
                console.log(`📊 [CHANNEL-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              } else {
                const allCallsDebug = await db.execute(sql`
                  SELECT vc.id, vc.status, vc.caller_id, vc.called_number, vc.call_direction, vc.created_at,
                         svc.id as svc_id, svc.from_number as svc_from, svc.target_phone as svc_target
                  FROM voice_calls vc
                  LEFT JOIN scheduled_voice_calls svc ON svc.voice_call_id = vc.id
                  WHERE vc.consultant_id = ${resolvedConsultantId} 
                    AND vc.status IN ('talking', 'calling')
                    AND (
                      vc.called_number = ${resolvedCalledNumber}
                      OR vc.caller_id = ${resolvedCalledNumber}
                      OR svc.from_number = ${resolvedCalledNumber}
                    )
                  ORDER BY vc.created_at DESC
                  LIMIT 10
                `);
                console.error(`❌ [CHANNEL-CHECK] CHANNELS STILL FULL after cleanup! ${newActiveCount}/${maxChannels} on ${resolvedCalledNumber}`);
                console.error(`❌ [CHANNEL-CHECK] Incoming callerId=${callerId} calledNumber=${resolvedCalledNumber} → REJECTING with 4429`);
                console.error(`❌ [CHANNEL-CHECK] Calls occupying channels:`);
                for (const row of (allCallsDebug.rows as any[])) {
                  console.error(`❌ [CHANNEL-CHECK]   → ${row.id} | status=${row.status} | caller=${row.caller_id} | called=${row.called_number} | dir=${row.call_direction} | svc_from=${row.svc_from || '-'} | svc_target=${row.svc_target || '-'} | created=${row.created_at}`);
                }
                console.log(`📊 [CHANNEL-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                return { channelsFull: true } as any;
              }
            } else {
              const allCallsDebug = await db.execute(sql`
                SELECT vc.id, vc.status, vc.caller_id, vc.called_number, vc.call_direction, vc.created_at,
                       svc.id as svc_id, svc.from_number as svc_from, svc.target_phone as svc_target
                FROM voice_calls vc
                LEFT JOIN scheduled_voice_calls svc ON svc.voice_call_id = vc.id
                WHERE vc.consultant_id = ${resolvedConsultantId} 
                  AND vc.status IN ('talking', 'calling')
                  AND (
                    vc.called_number = ${resolvedCalledNumber}
                    OR vc.caller_id = ${resolvedCalledNumber}
                    OR svc.from_number = ${resolvedCalledNumber}
                  )
                ORDER BY vc.created_at DESC
                LIMIT 10
              `);
              console.error(`❌ [CHANNEL-CHECK] CHANNELS FULL! Consultant ${resolvedConsultantId} has ${activeCount}/${maxChannels} active calls on ${resolvedCalledNumber}`);
              console.error(`❌ [CHANNEL-CHECK] Incoming callerId=${callerId} calledNumber=${resolvedCalledNumber} → REJECTING with 4429`);
              console.error(`❌ [CHANNEL-CHECK] Calls occupying channels (talking+calling) — verified on FreeSWITCH:`);
              for (const row of (allCallsDebug.rows as any[])) {
                console.error(`❌ [CHANNEL-CHECK]   → ${row.id} | status=${row.status} | caller=${row.caller_id} | called=${row.called_number} | dir=${row.call_direction} | svc_from=${row.svc_from || '-'} | svc_target=${row.svc_target || '-'} | created=${row.created_at}`);
              }
              if (allCallsDebug.rows.length === 0) {
                console.error(`❌ [CHANNEL-CHECK]   (nessuna chiamata attiva trovata — possibile race condition)`);
              }
              console.log(`📊 [CHANNEL-CHECK] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              return { channelsFull: true } as any;
            }
          }
        } else {
          console.log(`🔍 [ROUTING-DEBUG] No calledNumber provided → FALLING BACK to JWT consultantId: ${decoded.consultantId}`);
          console.log(`🔍 [ROUTING-DEBUG]   resolvedConsultantId remains: ${resolvedConsultantId}`);
          console.log(`⚠️ [PHONE SERVICE] No calledNumber provided - using JWT consultantId as fallback: ${decoded.consultantId}`);
          const fallbackChannelResult = await db.execute(sql`
            SELECT COUNT(*) as active_count FROM voice_calls 
            WHERE consultant_id = ${resolvedConsultantId} AND status = 'talking'
          `);
          const fallbackActiveCount = parseInt((fallbackChannelResult.rows[0] as any)?.active_count || '0', 10);
          if (fallbackActiveCount >= 5) {
            console.error(`❌ [PHONE SERVICE] Consultant ${resolvedConsultantId} has ${fallbackActiveCount}/5 active calls (fallback limit) → CHANNELS FULL (4429)`);
            return { channelsFull: true } as any;
          }
        }

        const { normalizePhoneNumber: normalizePhoneE164 } = await import('../routes/lead-import-router');
        const e164CallerId = normalizePhoneE164(callerId.replace(/\s+/g, ''));
        const normalizedCallerId = e164CallerId || callerId.replace(/\s+/g, '').replace(/^00/, '+');
        console.log(`📞 [PHONE SERVICE] Incoming call from ${normalizedCallerId} (raw: ${callerId}, e164: ${e164CallerId || 'failed'}) for consultant ${resolvedConsultantId}`);

        let userId: string | null = null;
        let userRole = 'anonymous_caller';
        let consultantVoice = 'Kore';
        let callInstruction: string | null = null;
        let callSourceTaskId: string | null = null;
        let callLeadContext: string | null = null;
        let instructionType: 'task' | 'reminder' | null = null;
        let scheduledCallId: string | null = null;
        let outboundTargetPhone: string | null = null;

        // ⚡ PARALLEL AUTH: Run 3 independent DB queries simultaneously instead of sequentially
        // Before: ~1163ms (3 sequential awaits ~400ms each)
        // After:  ~400ms (1 parallel await = slowest query)
        const parallelStart = Date.now();
        const [userByPhone, voiceSettingsRows, scheduledCallResult] = await Promise.all([
          storage.getUserByPhoneNumber(normalizedCallerId, resolvedConsultantId)
            .then(r => { console.log(`⏱️ [AUTH] userByPhone query: ${Date.now() - parallelStart}ms`); return r; })
            .catch(err => { console.warn(`⚠️ [PHONE SERVICE] Caller lookup failed (${Date.now() - parallelStart}ms):`, err.message); return null; }),

          db.select({ voiceId: consultantAvailabilitySettings.voiceId })
            .from(consultantAvailabilitySettings)
            .where(eq(consultantAvailabilitySettings.consultantId, resolvedConsultantId))
            .limit(1)
            .then(r => { console.log(`⏱️ [AUTH] voiceSettings query: ${Date.now() - parallelStart}ms`); return r; })
            .catch(err => { console.warn(`⚠️ [PHONE SERVICE] Voice settings failed (${Date.now() - parallelStart}ms):`, err.message); return [] as any[]; }),

          (_cachedScheduledCallRow && _cachedScheduledCallRow.consultant_id === resolvedConsultantId && _cachedScheduledCallRow.status === 'calling')
            ? Promise.resolve({ rows: [_cachedScheduledCallRow] }).then(r => { console.log(`⏱️ [AUTH] scheduledCall REUSED from early lookup: 0ms`); return r; })
            : scheduledCallIdParam
              ? db.execute(sql`
                  SELECT id, call_instruction, instruction_type, target_phone, custom_prompt, source_task_id 
                  FROM scheduled_voice_calls 
                  WHERE id = ${scheduledCallIdParam}
                    AND consultant_id = ${resolvedConsultantId}
                    AND status = 'calling'
                  LIMIT 1
                `).then(r => { console.log(`⏱️ [AUTH] scheduledCall query: ${Date.now() - parallelStart}ms`); return r; })
                .catch(err => { console.warn(`⚠️ [PHONE SERVICE] Scheduled call lookup failed (${Date.now() - parallelStart}ms):`, err.message); return { rows: [] }; })
              : Promise.resolve(null)
        ]);
        console.log(`⏱️ [AUTH-DETAIL] Parallel auth queries completed in ${Date.now() - parallelStart}ms (from authPhaseStart: +${Date.now() - authPhaseStart}ms)`);

        if (userByPhone) {
          userId = userByPhone.id;
          userRole = userByPhone.role;
          console.log(`✅ [PHONE SERVICE] Caller recognized: ${userByPhone.fullName || userByPhone.email} (${userId})`);
        } else {
          console.log(`📞 [PHONE SERVICE] Unknown caller - using anonymous mode`);
        }

        if (numberConfig?.voice_id) {
          consultantVoice = numberConfig.voice_id;
          console.log(`🎤 [PHONE SERVICE] Using voice from voice_numbers: ${consultantVoice}`);
        } else {
          const voiceSettings = voiceSettingsRows?.[0] as any;
          if (voiceSettings?.voiceId) {
            consultantVoice = voiceSettings.voiceId;
            console.log(`🎤 [PHONE SERVICE] Using consultant voice from settings: ${consultantVoice}`);
          }
        }

        if (scheduledCallIdParam) {
          console.log(`🔍 [PHONE SERVICE] Looking up scheduled call by ID: ${scheduledCallIdParam}`);
          
          if (scheduledCallResult && scheduledCallResult.rows.length > 0) {
            const scheduledCall = scheduledCallResult.rows[0] as any;
            callInstruction = scheduledCall.call_instruction;
            callLeadContext = scheduledCall.custom_prompt || null;
            instructionType = scheduledCall.instruction_type;
            scheduledCallId = scheduledCall.id;
            outboundTargetPhone = scheduledCall.target_phone;
            callSourceTaskId = scheduledCall.source_task_id || null;
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🎯 [PHONE SERVICE] FOUND SCHEDULED OUTBOUND CALL!`);
            console.log(`🎯   Scheduled Call ID: ${scheduledCallId}`);
            console.log(`🎯   Target Phone: ${outboundTargetPhone}`);
            console.log(`🎯   Type: ${instructionType || 'generic'}`);
            console.log(`🎯   Instruction: ${callInstruction || '(no instruction)'}`);
            console.log(`🎯   Lead Context: ${callLeadContext ? `${callLeadContext.substring(0, 80)}...` : '(none)'}`);
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            
            if (outboundTargetPhone) {
              const userByTargetPhone = await storage.getUserByPhoneNumber(outboundTargetPhone, resolvedConsultantId);
              if (userByTargetPhone) {
                userId = userByTargetPhone.id;
                userRole = userByTargetPhone.role;
                console.log(`✅ [PHONE SERVICE] OUTBOUND target recognized: ${userByTargetPhone.fullName || userByTargetPhone.email} (${userId})`);
              } else {
                console.log(`📞 [PHONE SERVICE] OUTBOUND target ${outboundTargetPhone} is not a registered client`);
              }
            }
          } else {
            scheduledCallId = scheduledCallIdParam;
            console.log(`📞 [PHONE SERVICE] Outbound call ${scheduledCallIdParam} not found with status 'calling', trying fallback...`);
            
            try {
              const fallbackResult = await db.execute(sql`
                SELECT target_phone FROM scheduled_voice_calls 
                WHERE id = ${scheduledCallIdParam}
                  AND consultant_id = ${resolvedConsultantId}
                LIMIT 1
              `);
              
              if (fallbackResult.rows.length > 0) {
                outboundTargetPhone = (fallbackResult.rows[0] as any).target_phone;
                console.log(`🎯 [PHONE SERVICE] Fallback: found target_phone = ${outboundTargetPhone}`);
                
                if (outboundTargetPhone) {
                  const userByTargetPhone = await storage.getUserByPhoneNumber(outboundTargetPhone, resolvedConsultantId);
                  if (userByTargetPhone) {
                    userId = userByTargetPhone.id;
                    userRole = userByTargetPhone.role;
                    console.log(`✅ [PHONE SERVICE] OUTBOUND target recognized (fallback): ${userByTargetPhone.fullName || userByTargetPhone.email} (${userId})`);
                  } else {
                    console.log(`📞 [PHONE SERVICE] OUTBOUND target ${outboundTargetPhone} is not a registered client`);
                  }
                }
              } else {
                console.log(`⚠️ [PHONE SERVICE] Fallback failed: scheduled call ${scheduledCallIdParam} not found at all`);
              }
            } catch (fallbackErr) {
              console.warn(`⚠️ [PHONE SERVICE] Fallback query failed:`, fallbackErr);
            }
          }
        } else {
          console.log(`📞 [PHONE SERVICE] Inbound call from ${normalizedCallerId} - no scheduled call instruction (by design)`);
        }

        // ⚡ FIRE-AND-FORGET: Voice call record creation doesn't block auth completion
        const voiceCallId = `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const freeswitchUuid = fsUuidParam || `ws_${Date.now()}`;
        const detectedDirection = (scheduledCallId && scheduledCallId.startsWith('sc_')) || (voiceCallIdParam && voiceCallIdParam.startsWith('outbound-')) ? 'outbound' : 'inbound';
        
        db.insert(voiceCalls).values({
          id: voiceCallId,
          callerId: normalizedCallerId,
          calledNumber: resolvedCalledNumber,
          callDirection: detectedDirection,
          clientId: userId || null,
          consultantId: resolvedConsultantId,
          freeswitchUuid: freeswitchUuid,
          status: 'talking',
          startedAt: new Date(),
          answeredAt: new Date(),
          aiMode: numberConfig?.ai_mode || 'assistenza',
        }).then(() => {
          console.log(`📞 [PHONE SERVICE] Voice call record created: ${voiceCallId}`);
        }).catch(dbErr => {
          console.error(`❌ [PHONE SERVICE] Failed to create voice call record:`, dbErr);
        });

        activeVoiceCalls.set(voiceCallId, {
          id: voiceCallId,
          callerId: normalizedCallerId,
          calledNumber: resolvedCalledNumber,
          scheduledCallId: scheduledCallId || null,
          consultantId: resolvedConsultantId,
          clientId: userId,
          startedAt: new Date(),
          status: 'talking',
        });

        console.log(`📞 [LIFECYCLE] WS Auth: scheduledCallId=${scheduledCallId || 'UNDEFINED'} | voiceCallId=${voiceCallId} | callerId=${normalizedCallerId} | calledNumber=${resolvedCalledNumber}`);
        if (scheduledCallId) {
          db.execute(sql`
            UPDATE scheduled_voice_calls 
            SET status = 'talking', voice_call_id = ${voiceCallId}, updated_at = NOW()
            WHERE id = ${scheduledCallId} AND status IN ('calling', 'completed')
          `).then(() => {
            console.log(`📞 [LIFECYCLE] scheduled_voice_calls ${scheduledCallId} → TALKING | voiceCallId=${voiceCallId}`);
          }).catch(err => {
            console.error(`❌ [LIFECYCLE] Failed to update scheduled_voice_calls to talking:`, err);
          });
        } else {
          console.log(`📞 [LIFECYCLE] No scheduledCallId — scheduled_voice_calls will NOT be updated to talking (inbound call or missing param)`);
        }

        console.log(`✅ WebSocket authenticated: Phone Service - CallerId: ${normalizedCallerId} - CalledNumber: ${resolvedCalledNumber} - Consultant: ${resolvedConsultantId}${userId ? ` - User: ${userId}` : ' - Anonymous'} - Voice: ${consultantVoice}${callInstruction ? ' - HAS INSTRUCTION' : ''}`);
        console.log(`⏱️ [AUTH-DETAIL] TOTAL auth phase: ${Date.now() - authPhaseStart}ms (JWT: sync, parallelQueries: ${Date.now() - parallelStart}ms, post-query logic: ${Date.now() - authPhaseStart - (Date.now() - parallelStart)}ms)`);

        console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 [ROUTING-DEBUG] FINAL AUTH RESULT for phone_service:`);
        console.log(`🔍 [ROUTING-DEBUG]   resolvedConsultantId: ${resolvedConsultantId}`);
        console.log(`🔍 [ROUTING-DEBUG]   userId: ${userId}`);
        console.log(`🔍 [ROUTING-DEBUG]   userRole: ${userRole}`);
        console.log(`🔍 [ROUTING-DEBUG]   voiceCallId: ${voiceCallId}`);
        console.log(`🔍 [ROUTING-DEBUG]   callInstruction: ${callInstruction ? callInstruction.substring(0, 50) + '...' : 'null'}`);
        console.log(`🔍 [ROUTING-DEBUG]   instructionType: ${instructionType}`);
        console.log(`🔍 [ROUTING-DEBUG]   scheduledCallId: ${scheduledCallId}`);
        console.log(`🔍 [ROUTING-DEBUG]   outboundTargetPhone: ${outboundTargetPhone || 'N/A'}`);
        console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return {
          userId: userId,
          role: userRole,
          consultantId: resolvedConsultantId,
          mode: 'assistenza' as const,
          consultantType: null,
          customPrompt: null,
          useFullPrompt: false,
          voiceName: consultantVoice,
          resumeHandle: resumeHandle,
          sessionType: null,
          conversationId: null,
          agentId: null,
          shareToken: null,
          inviteToken: null,
          testMode: null,
          isPhoneCall: true,
          phoneCallerId: outboundTargetPhone || normalizedCallerId,
          voiceCallId: voiceCallId,
          // 🎯 Call instruction for outbound calls
          phoneCallInstruction: callInstruction,
          phoneCallLeadContext: callLeadContext,
          phoneInstructionType: instructionType,
          phoneScheduledCallId: scheduledCallId,
          phoneVoiceCallId: voiceCallIdParam,
          phoneFsUuid: freeswitchUuid,
          phoneSourceTaskId: callSourceTaskId,
        };
      } catch (jwtError) {
        console.error('❌ Invalid phone_service token:', jwtError);
        return null;
      }
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
      const jwtDecodeStart = Date.now();
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;
      console.log(`⏱️ [AUTH] JWT verify (sales_agent): ${Date.now() - jwtDecodeStart}ms`);

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
      const agentQueryStart = Date.now();
      const agent = await storage.getClientSalesAgentByShareToken(shareToken);
      console.log(`⏱️ [AUTH] getAgentByShareToken query: ${Date.now() - agentQueryStart}ms`);
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
      const convQueryStart = Date.now();
      const conversation = await storage.getClientSalesConversationById(decoded.conversationId);
      console.log(`⏱️ [AUTH] getConversationById query: ${Date.now() - convQueryStart}ms`);
      if (!conversation) {
        console.error('❌ Conversation not found');
        return null;
      }

      console.log(`✅ WebSocket authenticated: Sales Agent Session - Conversation ${conversation.id} - Prospect: ${conversation.prospectName}`);
      if (testMode) {
        console.log(`🎯 [AI TRAINER] Test mode from WebSocket: ${testMode}`);
      }

      // 🔊 Use agent's configured voice, fallback to URL param or default
      const agentVoice = agent.voiceName || voiceName || 'Kore';
      console.log(`🎙️ [Sales Agent] Using voice: ${agentVoice} (agent: ${agent.voiceName}, url: ${voiceName})`);
      
      return {
        userId: null, // No user for sales agent mode
        role: 'prospect', // Virtual role
        consultantId: agent.consultantId,
        mode: 'sales_agent',
        consultantType: null,
        customPrompt: null,
        useFullPrompt: false,
        voiceName: agentVoice,
        resumeHandle: resumeHandle,
        sessionType: null,
        // Sales Agent specific
        conversationId: conversation.id,
        agentId: agent.id,
        shareToken: shareToken,
        inviteToken: null,
        // Test mode for AI Trainer
        testMode: testMode,
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
      const jwtDecodeStart = Date.now();
      const decoded = jwt.verify(sessionToken, JWT_SECRET) as any;
      console.log(`⏱️ [AUTH] JWT verify (consultation_invite): ${Date.now() - jwtDecodeStart}ms`);

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
      const inviteQueryStart = Date.now();
      const invite = await storage.getConsultationInviteByToken(inviteToken);
      console.log(`⏱️ [AUTH] getInviteByToken query: ${Date.now() - inviteQueryStart}ms`);
      if (!invite) {
        console.error('❌ Consultation invite not found');
        return null;
      }

      if (invite.status !== 'pending' && invite.status !== 'active') {
        console.error(`❌ Consultation invite is not active (status: ${invite.status})`);
        return null;
      }

      // Load agent to validate it's still active
      const agentQueryStart = Date.now();
      const agent = await storage.getClientSalesAgentById(invite.agentId);
      console.log(`⏱️ [AUTH] getAgentById query: ${Date.now() - agentQueryStart}ms`);
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
      const convQueryStart = Date.now();
      const conversation = await storage.getClientSalesConversationById(decoded.conversationId);
      console.log(`⏱️ [AUTH] getConversationById query: ${Date.now() - convQueryStart}ms`);
      if (!conversation) {
        console.error('❌ Conversation not found');
        return null;
      }

      console.log(`✅ WebSocket authenticated: Consultation Invite - Conversation ${conversation.id} - Prospect: ${conversation.prospectName} - Invite: ${inviteToken}`);

      // 🔊 Use agent's configured voice, fallback to URL param or default
      const agentVoice = agent.voiceName || voiceName || 'Kore';
      console.log(`🎙️ [Consultation Invite] Using voice: ${agentVoice} (agent: ${agent.voiceName}, url: ${voiceName})`);
      
      return {
        userId: null, // No user for consultation invite mode
        role: 'prospect', // Virtual role
        consultantId: agent.consultantId,
        mode: 'consultation_invite',
        consultantType: null,
        customPrompt: null,
        useFullPrompt: false,
        voiceName: agentVoice,
        resumeHandle: resumeHandle,
        sessionType: null,
        // Consultation Invite specific
        conversationId: conversation.id,
        agentId: agent.id,
        shareToken: null,
        inviteToken: inviteToken,
        testMode: null,
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
    const jwtDecodeStart = Date.now();
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    console.log(`⏱️ [AUTH] JWT verify (client): ${Date.now() - jwtDecodeStart}ms`);

    // Carica utente dal database per validare
    const userQueryStart = Date.now();
    const user = await storage.getUser(decoded.userId);
    console.log(`⏱️ [AUTH] getUser query: ${Date.now() - userQueryStart}ms`);

    if (!user) {
      console.error('❌ Invalid JWT: user not found');
      return null;
    }

    // Verifica che sia un client (supporta Email Condivisa profiles)
    // Email Condivisa: if JWT has profileId, use profile's role instead of user's database role
    let effectiveRole = user.role;
    if (decoded.profileId) {
      const profileQueryStart = Date.now();
      const profile = await storage.getUserRoleProfileById(decoded.profileId);
      console.log(`⏱️ [AUTH] getUserRoleProfile query: ${Date.now() - profileQueryStart}ms`);
      if (profile && profile.userId === user.id && profile.isActive) {
        effectiveRole = profile.role;
      }
    }

    if (effectiveRole !== 'client') {
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
      testMode: null,
    };
  } catch (error) {
    console.error('❌ JWT validation error:', error);
    return null;
  }
}

/**
 * Setup WebSocket server per Gemini Live API
 */
export function setupGeminiLiveWSService(): WebSocketServer {
  console.log('🔧 Setting up Gemini Live WebSocket server...');
  
  const wss = new WebSocketServer({ noServer: true });

  console.log('🔧 WebSocketServer instance created, attaching connection handler...');

  // Debug: log all WebSocketServer events
  wss.on('error', (error) => {
    console.error('❌ WebSocketServer error:', error);
  });

  wss.on('connection', async (clientWs, req) => {
    const connectionId = Math.random().toString(36).substring(7);
    const wsArrivalTime = Date.now();

    const warmupUrl = new URL(req.url || '', `http://${req.headers.host}`);
    if (warmupUrl.searchParams.get('mode') === 'warmup') {
      console.log(`🔥 [warmup] TLS warmup ping from VPS`);
      clientWs.close(1000, 'warmup_ok');
      return;
    }

    console.log(`🎤 [${connectionId}] Client connected to Live API`);
    console.log(`⏱️ [LATENCY-E2E] WebSocket arrival: ${new Date(wsArrivalTime).toISOString()}`);
    
    // 1. Autenticazione JWT ed estrazione parametri
    const authResult = await getUserIdFromRequest(req);
    if (!authResult) {
      console.error(`❌ [${connectionId}] Authentication failed`);
      clientWs.close(4401, 'Unauthorized - Valid JWT token required');
      return;
    }
    if (authResult && (authResult as any).channelsFull) {
      const urlParams = new URL(req.url || '', 'http://localhost').searchParams;
      const rejCalledNumber = urlParams.get('calledNumber') || 'unknown';
      const rejCallerId = urlParams.get('callerId') || 'unknown';
      console.error(`🔶 [${connectionId}] ━━━ CHANNELS FULL 4429 ━━━`);
      console.error(`🔶 [${connectionId}] Rejecting WS: callerId=${rejCallerId} calledNumber=${rejCalledNumber}`);
      console.error(`🔶 [${connectionId}] The VPS Bridge should catch this 4429 and route to overflow queue`);
      console.error(`🔶 [${connectionId}] ━━━━━━━━━━━━━━━━━━━━━━━━━`);
      clientWs.close(4429, 'CHANNELS_FULL');
      return;
    }

    const authDoneTime = Date.now();
    console.log(`⏱️ [LATENCY-E2E] Auth completed: +${authDoneTime - wsArrivalTime}ms from WS arrival`);

    const { userId, consultantId, mode, consultantType, customPrompt, useFullPrompt, voiceName, resumeHandle, sessionType, conversationId, agentId, shareToken, inviteToken, testMode, isPhoneCall, phoneCallerId, voiceCallId, phoneCallInstruction, phoneCallLeadContext, phoneInstructionType, phoneScheduledCallId, phoneVoiceCallId, phoneFsUuid, phoneSourceTaskId } = authResult;

    // ⚡ O4: EARLY-START parallel queries immediately after auth
    // These queries start running while 1400+ lines of variable declarations and function definitions execute
    // They'll be reused at their original location via the _earlyStarted* promises
    let _earlyStartedConsultantInfoPromise: Promise<any> | null = null;
    let _earlyStartedSettingsPromise: Promise<any> | null = null;
    let _earlyStartedPreviousConversationsPromise: Promise<any> | null = null;
    let _earlyStartedProactiveLeadPromise: Promise<any> | null = null;
    let _earlyStartedHunterContextPromise: Promise<HunterLeadContext | null> | null = null;
    // ⚡ O5: EARLY-START booking slots + task queries for ALL phone calls
    let _earlyStartedSlotsPromise: Promise<any> | null = null;
    let _earlyStartedTasksPromise: Promise<any> | null = null;
    
    // ⚡ O5: Start booking slots + task existing-tasks query for ALL phone calls (client + non-client)
    if (isPhoneCall && consultantId) {
      console.log(`⚡ [O5] EARLY-START: Launching slots + tasks queries immediately after auth`);
      
      _earlyStartedSlotsPromise = executeConsultationTool(
        "getAvailableSlots",
        { startDate: new Date().toISOString().slice(0, 10) },
        userId || 'voice_anonymous',
        consultantId,
        undefined,
        agentId || undefined
      ).catch((err: any) => {
        console.warn(`⚠️ [${connectionId}] [O5] Could not pre-load slots:`, err.message);
        return { success: false, result: null };
      });
      
      if (phoneCallerId) {
        _earlyStartedTasksPromise = db.execute(sql`
          SELECT id, ai_instruction, scheduled_at, recurrence_type, status, contact_name
          FROM ai_scheduled_tasks
          WHERE consultant_id = ${consultantId} AND (contact_phone = ${phoneCallerId}
            OR contact_phone = ${phoneCallerId.replace(/^\+/, '')}
            OR ('+' || contact_phone) = ${phoneCallerId})
          AND status IN ('scheduled', 'retry_pending', 'paused')
          AND (scheduled_at >= NOW() OR recurrence_type IN ('daily', 'weekly'))
          ORDER BY scheduled_at ASC
          LIMIT 20
        `).catch((err: any) => {
          console.warn(`⚠️ [${connectionId}] [O5] Could not pre-load tasks:`, err.message);
          return { rows: [] as any[] };
        });
      }
    }
    
    if (isPhoneCall && !userId && consultantId) {
      console.log(`⚡ [O4] EARLY-START: Launching non-client parallel queries immediately after auth`);
      
      const _cachedConsultantInfo = getCached(_consultantInfoCache, consultantId);
      if (_cachedConsultantInfo) {
        _earlyStartedConsultantInfoPromise = Promise.resolve(_cachedConsultantInfo);
        console.log(`⚡ [${connectionId}] [O4] ConsultantInfo CACHE HIT for ${consultantId}`);
      } else {
      _earlyStartedConsultantInfoPromise = storage.getUser(consultantId).then((user: any) => {
        if (user) _consultantInfoCache.set(consultantId, { data: user, ts: Date.now() });
        return user;
      }).catch((err: any) => {
        console.warn(`⚠️ [${connectionId}] [O4] Could not fetch consultant info:`, err);
        return null;
      });
      }
      
      console.log(`🔍 [ROUTING-DEBUG] Settings query: loading consultant_availability_settings for consultantId=${consultantId}`);
      const _cachedSettings = getCached(_settingsCache, consultantId);
      if (_cachedSettings) {
        _earlyStartedSettingsPromise = Promise.resolve(_cachedSettings);
        console.log(`⚡ [${connectionId}] [O4] Settings CACHE HIT for ${consultantId}`);
      } else {
        _earlyStartedSettingsPromise = db.select({
          voiceDirectives: consultantAvailabilitySettings.voiceDirectives,
          outboundPromptSource: consultantAvailabilitySettings.outboundPromptSource,
          outboundTemplateId: consultantAvailabilitySettings.outboundTemplateId,
          outboundAgentId: consultantAvailabilitySettings.outboundAgentId,
          outboundManualPrompt: consultantAvailabilitySettings.outboundManualPrompt,
          outboundBrandVoiceEnabled: consultantAvailabilitySettings.outboundBrandVoiceEnabled,
          outboundBrandVoiceAgentId: consultantAvailabilitySettings.outboundBrandVoiceAgentId,
          inboundPromptSource: consultantAvailabilitySettings.inboundPromptSource,
          inboundTemplateId: consultantAvailabilitySettings.inboundTemplateId,
          inboundAgentId: consultantAvailabilitySettings.inboundAgentId,
          inboundManualPrompt: consultantAvailabilitySettings.inboundManualPrompt,
          inboundBrandVoiceEnabled: consultantAvailabilitySettings.inboundBrandVoiceEnabled,
          inboundBrandVoiceAgentId: consultantAvailabilitySettings.inboundBrandVoiceAgentId,
          nonClientPromptSource: consultantAvailabilitySettings.nonClientPromptSource,
          nonClientAgentId: consultantAvailabilitySettings.nonClientAgentId,
          nonClientManualPrompt: consultantAvailabilitySettings.nonClientManualPrompt,
          voiceThinkingBudgetGreeting: consultantAvailabilitySettings.voiceThinkingBudgetGreeting,
          voiceProtectFirstMessage: consultantAvailabilitySettings.voiceProtectFirstMessage,
          voiceDeferredPrompt: consultantAvailabilitySettings.voiceDeferredPrompt,
          voiceAffectiveDialog: consultantAvailabilitySettings.voiceAffectiveDialog,
          voiceVadStartSensitivity: consultantAvailabilitySettings.voiceVadStartSensitivity,
          voiceVadEndSensitivity: consultantAvailabilitySettings.voiceVadEndSensitivity,
          voiceVadSilenceMs: consultantAvailabilitySettings.voiceVadSilenceMs,
        })
        .from(consultantAvailabilitySettings)
        .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
        .then((rows: any[]) => {
          _settingsCache.set(consultantId, { data: rows, ts: Date.now() });
          return rows;
        })
        .catch((err: any) => {
          console.warn(`⚠️ [${connectionId}] [O4] Could not fetch non-client settings:`, err);
          return [] as any[];
        });
      }
      
      if (phoneCallerId) {
        _earlyStartedPreviousConversationsPromise = db.execute(sql`
          SELECT 
            ac.id,
            ac.title,
            ac.created_at,
            (
              SELECT json_agg(msg_data ORDER BY msg_data->>'created_at' ASC)
              FROM (
                SELECT json_build_object(
                  'role', am.role,
                  'content', am.content,
                  'created_at', am.created_at
                ) as msg_data
                FROM ai_messages am
                WHERE am.conversation_id = ac.id
                ORDER BY am.created_at DESC
                LIMIT 30
              ) sub
            ) as messages
          FROM ai_conversations ac
          WHERE (ac.caller_phone = ${phoneCallerId}
            OR ac.caller_phone = ${phoneCallerId.replace(/^\+/, '')}
            OR ('+' || ac.caller_phone) = ${phoneCallerId})
            AND ac.consultant_id = ${consultantId}
          ORDER BY ac.created_at DESC
          LIMIT 100
        `).catch((err: any) => {
          console.warn(`⚠️ [${connectionId}] [O4] Could not load previous caller conversations:`, err);
          return { rows: [] as any[] };
        });
        
        _earlyStartedProactiveLeadPromise = db.execute(sql`
          SELECT 
            id,
            first_name,
            last_name,
            phone_number,
            email,
            lead_info,
            lead_category,
            status
          FROM proactive_leads
          WHERE consultant_id = ${consultantId}
            AND (
              phone_number = ${phoneCallerId}
              OR phone_number = ${phoneCallerId.replace(/^\+/, '')}
              OR ('+' || phone_number) = ${phoneCallerId}
            )
          ORDER BY created_at DESC
          LIMIT 1
        `).catch((err: any) => {
          console.warn(`⚠️ [${connectionId}] [O4] Could not lookup proactive lead:`, err.message);
          return { rows: [] as any[] };
        });

        _earlyStartedHunterContextPromise = resolveHunterContext({
          consultantId,
          phoneNumber: phoneCallerId,
        }).catch((err: any) => {
          console.warn(`⚠️ [${connectionId}] [O4] Could not lookup hunter context:`, err.message);
          return null;
        });
      }
    }

    const reqUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const incomingSilentStreak = parseInt(reqUrl.searchParams.get('silentStreak') || '0', 10) || 0;

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
    let goAwayReceived = false;
    let isGoAwayReconnecting = false;
    let geminiReconnectAttempts = 0;
    const MAX_GEMINI_RECONNECT_ATTEMPTS = 8;
    
    let turnsInCurrentSegment = 0;
    let consecutiveSilentResumes = incomingSilentStreak;
    const MAX_CONSECUTIVE_SILENT_RESUMES = 2;
    if (incomingSilentStreak > 0) {
      console.log(`🔇 [${connectionId}] Inherited silent streak from previous session: ${incomingSilentStreak}`);
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 💰 VERTEX AI LIVE API - Official Pricing (Nov 2024)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Token tracking per calcolo costi con supporto cache optimization
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCachedTokens = 0; // NEW: Track cached input tokens (94% cost savings!)
    let totalThinkingTokens = 0; // Track thinking/reasoning tokens
    let totalAudioInputSeconds = 0; // NEW: Track audio input duration
    let totalAudioOutputSeconds = 0; // NEW: Track audio output duration (most expensive!)
    
    // Official Live API pricing
    const PRICE_CACHED_PER_1M = 0.03;  // $0.03 per 1M tokens (cached input - 94% savings!)
    const PRICE_INPUT_PER_1M = 0.50;  // $0.50 per 1M tokens (fresh text input)
    const PRICE_AUDIO_INPUT_PER_1M = 3.00; // $3.00 per 1M tokens (audio input)
    const PRICE_OUTPUT_PER_1M = 12.00; // $12.00 per 1M tokens (audio output - most expensive!)
    
    // 🔍 TASK 5: Track initial chunk tokens for comparison report
    let sessionInitialChunkTokens = 0; // Estimated tokens from initial chunks sent to Gemini
    
    // 🔍 NEW: Track system instruction size for fresh token breakdown analysis
    let sessionSystemInstructionTokens = 0; // Tokens in system_instruction (sent in setup)
    let sessionSystemInstructionChars = 0; // Characters in system_instruction
    
    // 🔍 NEW: Track conversation history for breakdown analysis
    let sessionTurnCount = 0; // Number of turns completed
    
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
    let voiceAgentName: string | null = null;
    
    // Accumulatori per trascrizioni in tempo reale
    let currentUserTranscript = '';
    let currentAiTranscript = ''; // Full transcript including thinking (for logging/debug)
    let currentAiSpokenText = ''; // ONLY actual spoken words (outputTranscription) - used for saving to DB
    let currentAiAudioChunks: string[] = [];
    
    // ⏱️ PER-TURN LATENCY TRACKING
    let userFinishedSpeakingTime: number = 0; // Timestamp when isFinal received
    let lastInputTranscriptionTime: number = 0; // Timestamp of last inputTranscription chunk (fallback for phone calls where isFinal never arrives)
    let lastPhoneAudioReceivedTime: number = 0; // Timestamp of last audio chunk received from phone VPS
    let firstAudioSentToPhoneTime: number = 0; // Timestamp of first AI audio chunk sent to phone VPS in this turn
    let turnLatencyMeasured: boolean = false; // Reset each turn to measure first audio byte per turn
    let turnCount: number = 0; // Counts user→AI exchanges
    let turnSalesTrackerDoneTime: number = 0; // After salesTracker.trackUserMessage
    let turnFeedbackInjectedTime: number = 0; // After pendingFeedback injection
    let turnCommitDoneTime: number = 0; // After commitUserMessage
    let turnWatchdogStartedTime: number = 0; // After startResponseWatchdog
    let turnFirstGeminiResponseTime: number = 0; // First serverContent after user turn
    
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
    let bookingSupervisor: VoiceBookingSupervisor | null = null;
    let taskSupervisor: VoiceTaskSupervisor | null = null;
    let bookingAvailableSlots: AvailableSlot[] = [];
    let phoneLeadContactData: { name: string | null; email: string | null; phone: string | null; leadId: string | null; category: string | null } | null = null;
    
    // 📞 VOICE CALL TRANSCRIPT UPDATE: Debounced function to update transcript in DB
    let transcriptUpdateTimeout: NodeJS.Timeout | null = null;
    const TRANSCRIPT_UPDATE_DEBOUNCE_MS = 2000; // Update DB every 2 seconds max
    
    async function updateVoiceCallTranscriptInDb() {
      if (!voiceCallId || conversationMessages.length === 0) return;
      
      try {
        const transcriptText = conversationMessages
          .map(m => `[${m.role === 'user' ? 'Utente' : 'Alessia'}] ${m.transcript}`)
          .join('\n');
        
        await db
          .update(voiceCalls)
          .set({
            fullTranscript: transcriptText,
            updatedAt: new Date(),
          })
          .where(eq(voiceCalls.id, voiceCallId));
        
        console.log(`📝 [${connectionId}] Voice call transcript updated (${conversationMessages.length} messages)`);
      } catch (err) {
        console.warn(`⚠️ [${connectionId}] Failed to update voice call transcript:`, err);
      }
    }
    
    function scheduleTranscriptUpdate() {
      if (transcriptUpdateTimeout) {
        clearTimeout(transcriptUpdateTimeout);
      }
      transcriptUpdateTimeout = setTimeout(() => {
        updateVoiceCallTranscriptInDb();
      }, TRANSCRIPT_UPDATE_DEBOUNCE_MS);
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🕐 RESPONSE WATCHDOG - Rileva quando Gemini non risponde
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔧 UPDATED: Timeout ridotto per VAD più veloce
    // Il VAD aspetta 700ms di silenzio prima di inviare isFinal=true.
    // Con Proactive Audio, Gemini può prendere più tempo per decidere se rispondere.
    // Timeout = silence_duration_ms (700) + thinking_budget (256 tokens) + buffer (2000) = 3500ms
    let responseWatchdogTimer: NodeJS.Timeout | null = null;
    let userMessagePendingResponse = false;
    let lastUserFinalTranscript = '';
    let lastUserMessageTimestamp = 0;
    let lastUserMessageIndex = -1; // Tracks index of last real user message for supervisor gating
    let lastSupervisorUserIndex = -1; // Last user message index that supervisors already analyzed
    let responseWatchdogRetries = 0;
    let modelResponsePending = false; // 🆕 Flag: Gemini ha iniziato a elaborare (qualsiasi serverContent ricevuto)
    let lastAiTurnCompleteTimestamp = 0; // 🆕 FIX: Traccia quando l'AI ha completato l'ultimo turno
    const RESPONSE_WATCHDOG_TIMEOUT_MS = 3500; // 🔧 REDUCED: silence (700) + thinking + processing buffer
    const MAX_WATCHDOG_RETRIES = 2;
    const MIN_TIME_AFTER_AI_RESPONSE_MS = 2000; // 🆕 Non avviare watchdog se AI ha risposto negli ultimi 2 sec
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🔬 DIAGNOSTIC TRACKING - Per capire PERCHÉ Gemini non risponde
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let audioChunksSentSinceLastResponse = 0;  // Contatore audio chunks inviati
    let lastDiscardedAudioLogTime: number | null = null;  // Throttle log for discarded audio
    let lastServerContentTimestamp = 0;         // Quando è arrivato l'ultimo serverContent
    let lastServerContentType: 'audio' | 'text' | 'metadata' | 'none' = 'none';  // Tipo ultimo serverContent
    let isFinalReceivedForCurrentTurn = false;  // Se isFinal è stato ricevuto per il turno corrente
    let lastActivityTimestamp = Date.now();     // Timestamp ultima attività (per super-watchdog)
    let userSpeakingStartTime: number | null = null;  // Quando l'utente ha iniziato a parlare
    const ISFINAL_BACKUP_TIMEOUT_MS = 10000;    // Forza watchdog se isFinal non arriva in 10 sec
    const SUPER_WATCHDOG_TIMEOUT_MS = 15000;    // Super-watchdog: resetta flag stuck dopo 15 sec silenzio
    const SUPER_WATCHDOG_CHECK_INTERVAL_MS = 5000; // Controlla ogni 5 sec
    
    /**
     * 🔬 DIAGNOSTICA: Analizza PERCHÉ Gemini non sta rispondendo
     * Chiamata quando scatta il watchdog timeout
     */
    function diagnoseNoResponse(): string[] {
      const diagnostics: string[] = [];
      const now = Date.now();
      
      // 1. isFinal check
      if (!isFinalReceivedForCurrentTurn) {
        diagnostics.push("❌ CAUSA 1: isFinal MAI ricevuto - Gemini VAD non ha rilevato fine parlato utente");
      } else {
        diagnostics.push("✓ isFinal ricevuto correttamente");
      }
      
      // 2. Audio chunks check
      if (audioChunksSentSinceLastResponse === 0) {
        diagnostics.push("❌ CAUSA 2: 0 audio chunks inviati - Nessun audio arrivato dal client");
      } else {
        diagnostics.push(`✓ ${audioChunksSentSinceLastResponse} audio chunks inviati a Gemini`);
      }
      
      // 3. serverContent check
      if (lastServerContentTimestamp === 0) {
        diagnostics.push("❌ CAUSA 3: Nessun serverContent MAI ricevuto da Gemini");
      } else {
        const msSinceLastContent = now - lastServerContentTimestamp;
        diagnostics.push(`⏱ Ultimo serverContent: ${msSinceLastContent}ms fa (tipo: ${lastServerContentType})`);
        if (lastServerContentType === 'metadata') {
          diagnostics.push("⚠️ CAUSA 3b: Ultimo serverContent era solo METADATA (no audio/text)");
        }
      }
      
      // 4. Flag check
      if (isAiSpeaking) {
        diagnostics.push("⚠️ CAUSA 4a: isAiSpeaking = true (POTREBBE ESSERE STUCK!)");
      }
      if (modelResponsePending) {
        diagnostics.push("⚠️ CAUSA 4b: modelResponsePending = true (POTREBBE ESSERE STUCK!)");
      }
      
      // 5. WebSocket state check
      if (!geminiSession) {
        diagnostics.push("❌ CAUSA 5: geminiSession è NULL");
      } else if (geminiSession.readyState !== WebSocket.OPEN) {
        const stateMap: Record<number, string> = {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED'
        };
        diagnostics.push(`❌ CAUSA 5: Gemini WebSocket NON APERTO (state: ${stateMap[geminiSession.readyState] || geminiSession.readyState})`);
      } else {
        diagnostics.push("✓ Gemini WebSocket OPEN");
      }
      
      // 6. Activity timestamp check
      const silenceMs = now - lastActivityTimestamp;
      if (silenceMs > 10000) {
        diagnostics.push(`⚠️ CAUSA 6: Silenzio totale da ${Math.round(silenceMs / 1000)} secondi`);
      }
      
      // 7. User speaking start check
      if (userSpeakingStartTime !== null) {
        const speakingDuration = now - userSpeakingStartTime;
        diagnostics.push(`📊 Utente parla da: ${Math.round(speakingDuration / 1000)} secondi`);
      }
      
      return diagnostics;
    }
    
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
      // 🆕 FIX: Non avviare watchdog se l'AI ha appena completato un turno
      // Questo previene retry inutili quando il messaggio utente arriva durante/dopo una risposta
      const timeSinceLastAiResponse = Date.now() - lastAiTurnCompleteTimestamp;
      if (lastAiTurnCompleteTimestamp > 0 && timeSinceLastAiResponse < MIN_TIME_AFTER_AI_RESPONSE_MS) {
        console.log(`⏭️  [${connectionId}] WATCHDOG SKIPPED - AI ha appena risposto (${timeSinceLastAiResponse}ms fa, min: ${MIN_TIME_AFTER_AI_RESPONSE_MS}ms)`);
        return;
      }
      
      // Cancella timer precedente se esiste
      if (responseWatchdogTimer) {
        clearTimeout(responseWatchdogTimer);
      }
      
      userMessagePendingResponse = true;
      modelResponsePending = false; // Reset per nuovo turno
      lastUserFinalTranscript = transcript;
      lastUserMessageTimestamp = Date.now();
      
      console.log(`\n🕐 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🕐 [${connectionId}] WATCHDOG STARTED - Aspetto risposta Gemini entro ${RESPONSE_WATCHDOG_TIMEOUT_MS}ms`);
      console.log(`   📝 Messaggio utente: "${transcript.substring(0, 60)}${transcript.length > 60 ? '...' : ''}"`);
      console.log(`🕐 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      responseWatchdogTimer = setTimeout(() => {
        // 🆕 FIX: Prima di fare retry, controlla se Gemini sta già rispondendo
        // Questo previene il bug dove il retry interrompe una risposta in corso
        if (isAiSpeaking || modelResponsePending) {
          console.log(`✅ [${connectionId}] WATCHDOG SKIPPED - Gemini sta già rispondendo (isAiSpeaking=${isAiSpeaking}, modelResponsePending=${modelResponsePending})`);
          cancelResponseWatchdog();
          return;
        }
        
        if (userMessagePendingResponse) {
          const elapsedMs = Date.now() - lastUserMessageTimestamp;
          
          console.log(`\n⚠️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`⚠️ [${connectionId}] WATCHDOG TIMEOUT - Gemini non ha risposto in ${elapsedMs}ms!`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // 🔬 DIAGNOSTICA: Analizza PERCHÉ Gemini non ha risposto
          console.log(`\n🔬 DIAGNOSI - PERCHÉ GEMINI NON HA RISPOSTO:`);
          const diagnostics = diagnoseNoResponse();
          diagnostics.forEach(d => console.log(`   ${d}`));
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
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
            console.log(`🔴 [${connectionId}] MAX RETRY RAGGIUNTO (${MAX_WATCHDOG_RETRIES}) - Mandando fallback phrase al Gemini`);
            userMessagePendingResponse = false;
            responseWatchdogRetries = 0;
            
            // 🎤 Manda a Gemini di dire la fallback phrase
            const fallbackMessage = {
              clientContent: {
                turns: [{
                  role: 'user',
                  parts: [{ text: `[SISTEMA: L'utente non ha risposto. Rispondi semplicemente e naturalmente con questa frase in italiano: "Non ti ho sentito bene, puoi ripetere perfavore?"]` }]
                }],
                turnComplete: true
              }
            };
            
            try {
              session.send(JSON.stringify(fallbackMessage));
              console.log(`   ✅ Fallback phrase inviata a Gemini - farà lui la sintesi vocale`);
            } catch (sendErr: any) {
              console.error(`   ❌ Errore invio fallback: ${sendErr.message}`);
              clientWs.send(JSON.stringify({
                type: 'ai_timeout',
                message: 'L\'AI non sta rispondendo. Riprova a parlare.',
                elapsedMs
              }));
            }
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
      modelResponsePending = false;
      
      // 🔬 DIAGNOSTIC: Reset tracking variables for next turn
      audioChunksSentSinceLastResponse = 0;
      isFinalReceivedForCurrentTurn = false;
      userSpeakingStartTime = null;
      lastActivityTimestamp = Date.now();
    }
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🦮 SUPER-WATCHDOG: Resetta flag stuck dopo silenzio prolungato
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    let superWatchdogInterval: NodeJS.Timeout | null = null;
    let isFinalBackupTimer: NodeJS.Timeout | null = null;
    
    function startSuperWatchdog() {
      if (superWatchdogInterval) return; // Already running
      
      superWatchdogInterval = setInterval(() => {
        const now = Date.now();
        const silenceMs = now - lastActivityTimestamp;
        
        // Check if flags are stuck after 15 seconds of silence
        if (silenceMs > SUPER_WATCHDOG_TIMEOUT_MS && (isAiSpeaking || modelResponsePending)) {
          console.warn(`\n🦮 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.warn(`🦮 [${connectionId}] SUPER-WATCHDOG: Flags STUCK detected!`);
          console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.warn(`   ⏱ Silence duration: ${Math.round(silenceMs / 1000)} seconds`);
          console.warn(`   🔴 isAiSpeaking: ${isAiSpeaking} → RESETTING to false`);
          console.warn(`   🔴 modelResponsePending: ${modelResponsePending} → RESETTING to false`);
          console.warn(`🦮 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          isAiSpeaking = false;
          modelResponsePending = false;
          lastActivityTimestamp = now; // Prevent repeated resets
        }
        
        // 🔧 BACKUP WATCHDOG: Force watchdog if isFinal never arrives
        // This handles the case where Gemini VAD doesn't detect end of speech
        if (userSpeakingStartTime !== null && !isFinalReceivedForCurrentTurn) {
          const speakingDuration = now - userSpeakingStartTime;
          
          if (speakingDuration > ISFINAL_BACKUP_TIMEOUT_MS) {
            console.warn(`\n⏰ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.warn(`⏰ [${connectionId}] BACKUP WATCHDOG: isFinal timeout!`);
            console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.warn(`   ⏱ User speaking for: ${Math.round(speakingDuration / 1000)} seconds`);
            console.warn(`   ❌ isFinal NEVER received from Gemini VAD`);
            console.warn(`   🔧 Action: Forcing watchdog with current transcript`);
            console.warn(`⏰ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // Force isFinal and start watchdog
            isFinalReceivedForCurrentTurn = true;
            userSpeakingStartTime = null;
            
            // Start watchdog with whatever transcript we have
            if (currentUserTranscript && geminiSession) {
              startResponseWatchdog(currentUserTranscript, geminiSession);
            }
          }
        }
      }, SUPER_WATCHDOG_CHECK_INTERVAL_MS);
      
      console.log(`🦮 [${connectionId}] Super-watchdog started (checks every ${SUPER_WATCHDOG_CHECK_INTERVAL_MS / 1000}s)`);
    }
    
    function stopSuperWatchdog() {
      if (superWatchdogInterval) {
        clearInterval(superWatchdogInterval);
        superWatchdogInterval = null;
        console.log(`🦮 [${connectionId}] Super-watchdog stopped`);
      }
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
      
      lastUserMessageIndex = conversationMessages.length - 1;
      console.log(`💾 [${connectionId}] Saved USER message: "${trimmed.substring(0, 80)}${trimmed.length > 80 ? '...' : ''}" (${conversationMessages.length} total, userIdx: ${lastUserMessageIndex})`);
      
      // 📞 Update voice call transcript in real-time
      scheduleTranscriptUpdate();
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
          
          // 🔒 STICKY VALIDATION: Carica gli item validati dal database
          // Se esistono item già validati da sessioni precedenti, li carichiamo in memoria
          const loadedValidatedItems = salesTracker.getValidatedCheckpointItems();
          if (Object.keys(loadedValidatedItems).length > 0) {
            persistentValidatedItems = loadedValidatedItems;
            console.log(`🔒 [${connectionId}] STICKY VALIDATION: Loaded ${Object.keys(loadedValidatedItems).length} checkpoints with validated items from DB`);
            Object.entries(loadedValidatedItems).forEach(([cpId, items]) => {
              console.log(`   → ${cpId}: ${items.length} validated items`);
            });
          }
          
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
    
    // 🔇 POST-RESUME SILENCE: Block AI output until user speaks after session resume
    // This prevents AI from "inventing" things when WebSocket reconnects
    let suppressAiOutputAfterResume = false; // Set to true after resume, reset when user speaks
    
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
      // 2. Get Live API credentials (⚡ deferred await - runs in parallel with data loading)
      // Try Google AI Studio first (has preview-12-2025 with thinking + better quality), fallback to Vertex AI
      console.log(`🔑 [${connectionId}] Starting Live API credential resolution (Google AI Studio → Vertex AI fallback)...`);
      const googleStudioConfigPromise = getGoogleAIStudioKeyForLive(consultantId);
      const vertexConfigPromise = getVertexAITokenForLive(
        (mode === 'sales_agent' || mode === 'consultation_invite') ? null : userId, 
        consultantId
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 🚀 O3: PRE-CONNECT Gemini WS in parallel with data loading
      // Resolve credentials → determine backend → start TLS handshake
      // All while data loading continues. Saves ~200-500ms of TLS latency.
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const geminiPreConnectPromise = (async () => {
        const preConnectStart = Date.now();
        const [gConfig, vConfig] = await Promise.all([googleStudioConfigPromise, vertexConfigPromise]);
        
        const providerEnv = (process.env.LIVE_API_PROVIDER || 'auto').toLowerCase().trim();
        let backend: 'google_ai_studio' | 'vertex_ai';
        let url: string;
        let modelId: string;
        
        console.log(`🔧 [${connectionId}] O3: LIVE_API_PROVIDER env var: "${providerEnv}"`);
        
        if (providerEnv === 'ai_studio') {
          if (!gConfig) {
            throw new Error('LIVE_API_PROVIDER=ai_studio but Google AI Studio credentials are not available');
          }
          backend = 'google_ai_studio';
          modelId = gConfig.modelId;
          url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${gConfig.apiKey}`;
          console.log(`🔵 [${connectionId}] O3: Using GOOGLE AI STUDIO (forced by LIVE_API_PROVIDER=ai_studio) - Model: ${modelId}`);
        } else if (providerEnv === 'vertex_ai') {
          if (!vConfig) {
            throw new Error('LIVE_API_PROVIDER=vertex_ai but Vertex AI credentials are not available');
          }
          backend = 'vertex_ai';
          modelId = vConfig.modelId;
          url = `wss://${vConfig.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
          console.log(`🟢 [${connectionId}] O3: Using VERTEX AI (forced by LIVE_API_PROVIDER=vertex_ai) - Model: ${modelId}, Location: ${vConfig.location}`);
        } else if (gConfig) {
          backend = 'google_ai_studio';
          modelId = gConfig.modelId;
          url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${gConfig.apiKey}`;
          console.log(`🔵 [${connectionId}] O3: Using GOOGLE AI STUDIO (auto: Studio available) - Model: ${modelId}`);
        } else if (vConfig) {
          backend = 'vertex_ai';
          modelId = vConfig.modelId;
          url = `wss://${vConfig.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
          console.log(`🟢 [${connectionId}] O3: Using VERTEX AI (auto: Studio unavailable) - Model: ${modelId}, Location: ${vConfig.location}`);
        } else {
          throw new Error('Failed to get Live API credentials - neither Google AI Studio nor Vertex AI available');
        }
        
        let ws: WebSocket;
        if (backend === 'google_ai_studio') {
          ws = new WebSocket(url);
        } else {
          ws = new WebSocket(url, {
            headers: {
              'Authorization': `Bearer ${vConfig!.accessToken}`,
              'Content-Type': 'application/json',
            }
          });
        }
        
        try {
          await new Promise<void>((resolve, reject) => {
            ws.on('open', () => resolve());
            ws.on('error', (err) => reject(err));
            setTimeout(() => reject(new Error('Gemini WS pre-connect timeout (10s)')), 10000);
          });
        } catch (networkErr) {
          console.warn(`⚠️ [${connectionId}] O3: WS handshake failed (transient), will fall back to sequential: ${(networkErr as Error).message}`);
          try { ws.close(); } catch (_) {}
          return null;
        }
        
        const elapsed = Date.now() - preConnectStart;
        console.log(`🚀 [${connectionId}] O3: Gemini WS pre-connected in ${elapsed}ms (parallel with data loading) - backend: ${backend}`);
        
        return { ws, backend, modelId, gConfig, vConfig, preConnectElapsed: elapsed };
      })().catch((err) => {
        console.error(`❌ [${connectionId}] O3: Pre-connect credential/config error: ${(err as Error).message}`);
        return { error: err as Error };
      });

      // 2b. Build prompts based on mode
      let systemInstruction: string;
      let userDataContext: string | null = null;
      let userContext: any = null; // Declare here to be accessible throughout the function
      let conversationHistory: Array<{role: 'user' | 'assistant'; content: string; timestamp: Date}> = []; // For sales_agent/consultation_invite modes
      let agentBusinessContext: { businessName: string; whatWeDo: string; servicesOffered: string[]; targetClient: string; nonTargetClient: string } | undefined = undefined; // 🆕 Business context per feedback
      let voiceThinkingBudget = 0;
      let voiceProtectFirstMessage = true;
      let voiceDeferredPrompt = false;
      let voiceAffectiveDialog = false;
      let voiceVadStartSensitivity = 'START_SENSITIVITY_HIGH';
      let voiceVadEndSensitivity = 'END_SENSITIVITY_LOW';
      let voiceVadSilenceMs = 500;
      let firstAiTurnComplete = false;

      let _ncLatency = {
        parallelQueriesStartTime: 0,
        consultantInfoResolvedTime: 0,
        settingsResolvedTime: 0,
        previousConversationsResolvedTime: 0,
        proactiveLeadResolvedTime: 0,
        brandVoiceResolvedTime: 0,
        promptBuildDoneTime: 0,
        previousConversationsCount: 0,
        previousConversationsDbRows: 0,
        voiceDirectivesChars: 0,
        brandVoiceChars: 0,
        contentPromptChars: 0,
        previousCallContextChars: 0,
        isNonClientCall: false,
        hasInstruction: false,
        hasCallHistory: false,
        callDirection: '' as string,
        promptSource: '' as string,
        deferredCallHistory: '' as string,
        deferredContentChunk: '' as string,
      };
      
      // 🆕 ARCHETYPE STATE PERSISTENCE - Mantiene lo stato dell'archetipo tra le chiamate al SalesManager
      // Questo risolve il problema di perdita dello stato tra turni di conversazione
      let persistentArchetypeState: {
        current: string;
        confidence: number;
        consecutiveSignals: number;
        lastUpdatedAtTurn: number;
        turnsSinceUpdate: number;
        lastSignalType: string | null;
        regexSignals: string[];
        aiIntuition: string | null;
      } | undefined = undefined;
      
      // 🔒 STICKY VALIDATION: Mantiene gli item checkpoint già validati tra le chiamate
      // Una volta verde, resta verde - evita che l'AI "dimentichi" validazioni precedenti
      // Struttura: { "checkpoint_phase_1": [{ check: "...", status: "validated", ... }], ... }
      let persistentValidatedItems: Record<string, Array<{
        check: string;
        status: 'validated' | 'missing' | 'vague';
        infoCollected?: string;
        evidenceQuote?: string;
        reason?: string;
      }>> = {};
      
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
          voiceAgentName = agent?.agentName || agent?.name || null;
        } else {
          // consultation_invite mode: load agent from invite
          const invite = await storage.getConsultationInviteByToken(inviteToken!);
          if (invite) {
            agent = await storage.getClientSalesAgentById(invite.agentId);
            voiceAgentName = agent?.agentName || agent?.name || null;
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
                consultantId: consultantId,
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
                  consultantId: consultantId,
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
        // 🆕 Passa discoveryRec se presente (fasi demo/objections/closing)
        const savedDiscoveryRec = conversation.discoveryRec as DiscoveryRec | undefined;
        if (savedDiscoveryRec && conversation.currentPhase !== 'discovery') {
          console.log(`📋 [${connectionId}] Discovery REC found in DB - will inject into prompt`);
          console.log(`   → Motivazione: ${savedDiscoveryRec.motivazioneCall?.substring(0, 40)}...`);
          console.log(`   → Urgenza: ${savedDiscoveryRec.urgenza || 'N/D'}`);
        }
        
        userDataContext = await buildFullSalesAgentContextAsync(
          agent,
          prospectData,
          conversation.currentPhase,
          conversationHistory,
          scriptPosition,
          savedDiscoveryRec  // 🆕 Pass Discovery REC if available
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
        // 📚 TRAINING SYSTEM: Log COMPLETE prompt - DEFERRED to avoid blocking critical path
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const _deferredTrainingSysInst = systemInstruction;
        const _deferredTrainingUserData = userDataContext;
        const _deferredTrainingConvId = conversationId;
        setImmediate(() => {
          console.log(`\n╔${'═'.repeat(78)}╗`);
          console.log(`║ 📚 [TRAINING] COMPLETE SYSTEM PROMPT - SENT TO GEMINI${' '.repeat(24)} ║`);
          console.log(`╠${'═'.repeat(78)}╣`);
          console.log(`║ ConversationId: ${(_deferredTrainingConvId || 'NULL').padEnd(57)} ║`);
          console.log(`║ Total Length: ${String(_deferredTrainingSysInst.length + _deferredTrainingUserData.length).padStart(10)} chars${' '.repeat(51)} ║`);
          console.log(`╠${'═'.repeat(78)}╣`);
          console.log(`║ PART 1: Minimal System Instruction (${_deferredTrainingSysInst.length} chars)${' '.repeat(Math.max(0, 34 - String(_deferredTrainingSysInst.length).length))} ║`);
          console.log(`╚${'═'.repeat(78)}╝\n`);
          console.log(_deferredTrainingSysInst);
          console.log(`\n╔${'═'.repeat(78)}╗`);
          console.log(`║ PART 2: Full Sales Agent Context (${_deferredTrainingUserData.length} chars)${' '.repeat(Math.max(0, 34 - String(_deferredTrainingUserData.length).length))} ║`);
          console.log(`╚${'═'.repeat(78)}╝\n`);
          console.log(_deferredTrainingUserData);
          console.log(`\n╔${'═'.repeat(78)}╗`);
          console.log(`║ 📚 [TRAINING] END OF COMPLETE PROMPT${' '.repeat(41)} ║`);
          console.log(`╚${'═'.repeat(78)}╝\n`);
        });
      } 
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PHONE CALL - UNKNOWN CALLER MODE (Non-Client)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      else if (isPhoneCall && !userId) {
        // Will be determined later after checking previous conversations
        let nonClientHasPreviousConversations = false;
        
        console.log(`\n📞 [${connectionId}] Phone call from UNKNOWN CALLER - loading dynamic non-client prompt`);
        
        // ⚡ O4: Reuse early-started parallel queries (launched right after auth, ~1400 lines ago)
        // Queries have been running in background during variable declarations and function definitions
        const _ncParallelStart = Date.now();
        _ncLatency.parallelQueriesStartTime = _ncParallelStart;
        _ncLatency.isNonClientCall = true;
        console.log(`⏱️ [NC-LATENCY] Auth → parallel queries start gap: ${_ncParallelStart - authDoneTime}ms (queries already running since auth)`);
        
        const _consultantInfoPromise = _earlyStartedConsultantInfoPromise || Promise.resolve(null);
        const _settingsPromise = _earlyStartedSettingsPromise || Promise.resolve([] as any[]);
        const _previousConversationsPromise = _earlyStartedPreviousConversationsPromise || Promise.resolve({ rows: [] as any[] });
        const _proactiveLeadPromise = _earlyStartedProactiveLeadPromise || Promise.resolve({ rows: [] as any[] });
        
        // ⚡ Await consultant info (started in parallel above)
        let consultantName = 'il consulente';
        let consultantBusinessName = '';
        const _consultantResult = await _consultantInfoPromise;
        _ncLatency.consultantInfoResolvedTime = Date.now();
        console.log(`⏱️ [NC-LATENCY] consultantInfo resolved: +${_ncLatency.consultantInfoResolvedTime - _ncParallelStart}ms`);
        if (_consultantResult) {
          const fullName = [(_consultantResult as any).firstName, (_consultantResult as any).lastName].filter(Boolean).join(' ').trim();
          consultantName = fullName || (_consultantResult as any).email?.split('@')[0] || 'il consulente';
          consultantBusinessName = (_consultantResult as any).businessName || '';
          console.log(`📞 [${connectionId}] Consultant info: ${consultantName}${consultantBusinessName ? ` (${consultantBusinessName})` : ''}`);
        }
        console.log(`⚡ [PHONE SERVICE] Non-client parallel queries launched in ${Date.now() - _ncParallelStart}ms (consultant resolved, settings+history running)`)
        
        let consultantDetailedProfileSection = '';
        if (consultantId) {
          try {
            const detailedProfileResult = await db.select().from(consultantDetailedProfiles).where(eq(consultantDetailedProfiles.consultantId, consultantId));
            const dp = detailedProfileResult[0];
            consultantDetailedProfileSection = buildDetailedProfileSection(dp);
            if (consultantDetailedProfileSection) {
              console.log(`📋 [${connectionId}] Detailed profile loaded (${consultantDetailedProfileSection.length} chars)`);
            }
          } catch (dpErr: any) {
            console.warn(`⚠️ [${connectionId}] Failed to load detailed profile: ${dpErr.message}`);
          }
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ⚡ PROACTIVE LEAD DATA - Await lead lookup (used by BOTH instruction and non-instruction paths)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        let leadContactData: { name: string | null; email: string | null; phone: string | null; leadId: string | null; category: string | null } = {
          name: null, email: null, phone: phoneCallerId || null, leadId: null, category: null
        };
        
        try {
          const proactiveLeadResult = await _proactiveLeadPromise;
          _ncLatency.proactiveLeadResolvedTime = Date.now();
          console.log(`⏱️ [NC-LATENCY] proactiveLead resolved: +${_ncLatency.proactiveLeadResolvedTime - _ncParallelStart}ms`);
          if (proactiveLeadResult.rows.length > 0) {
            const lead = proactiveLeadResult.rows[0] as any;
            const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
            const leadInfo = typeof lead.lead_info === 'string' ? JSON.parse(lead.lead_info) : lead.lead_info;
            const leadEmail = lead.email || leadInfo?.email || null;
            
            leadContactData = {
              name: leadName || null,
              email: leadEmail,
              phone: lead.phone_number || phoneCallerId || null,
              leadId: lead.id,
              category: lead.lead_category || null,
            };
            
            console.log(`📋 [${connectionId}] Proactive lead FOUND: ${leadName || '(no name)'} | email: ${leadEmail || '(none)'} | category: ${lead.lead_category || '(none)'} | id: ${lead.id}`);
          } else {
            console.log(`📋 [${connectionId}] No proactive lead found for ${phoneCallerId}`);
          }
        } catch (err) {
          console.warn(`⚠️ [${connectionId}] Proactive lead lookup error:`, err);
        }
        
        phoneLeadContactData = leadContactData;

        let hunterContext: HunterLeadContext | null = null;
        if (_earlyStartedHunterContextPromise) {
          try {
            hunterContext = await _earlyStartedHunterContextPromise;
            if (hunterContext) {
              console.log(`🔍 [${connectionId}] Hunter context loaded: ${hunterContext.businessName} (score: ${hunterContext.score})`);
            }
          } catch (err) {
            console.warn(`⚠️ [${connectionId}] Hunter context resolution error:`, err);
          }
        }
        const hunterContextBlock = hunterContext ? formatHunterContextForPrompt(hunterContext) : '';
        
        // 🎯 PRIORITY CHECK: If there's a specific call instruction, use ONLY that
        if (phoneCallInstruction) {
          console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🎯 [${connectionId}] USING CALL INSTRUCTION (PRIORITY MODE)`);
          console.log(`🎯   Type: ${phoneInstructionType || 'generic'}`);
          console.log(`🎯   Instruction: ${phoneCallInstruction}`);
          console.log(`🎯   Scheduled Call ID: ${phoneScheduledCallId}`);
          console.log(`🎯   Consultant: ${consultantName}`);
          console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Get current Italian time
          const italianTime = new Date().toLocaleString('it-IT', { 
            timeZone: 'Europe/Rome',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // ⚡ Await pre-started settings promise (runs in parallel with other queries)
          let consultantVoiceDirectives = '';
          let outboundPromptSource: 'agent' | 'manual' | 'default' = 'default';
          let outboundTemplateId = 'sales-orbitale';
          let outboundAgentId: string | null = null;
          let outboundManualPrompt = '';
          let outboundBrandVoiceEnabled = false;
          let outboundBrandVoiceAgentId: string | null = null;
          
          const settingsResult = await _settingsPromise;
          _ncLatency.settingsResolvedTime = Date.now();
          console.log(`⏱️ [NC-LATENCY] settings resolved (instruction path): +${_ncLatency.settingsResolvedTime - _ncParallelStart}ms`);
          if (settingsResult.length > 0) {
            const settings = settingsResult[0] as any;
            if (settings.voiceDirectives) {
              consultantVoiceDirectives = settings.voiceDirectives;
              console.log(`🎙️ [${connectionId}] Using consultant voice directives (${consultantVoiceDirectives.length} chars)`);
            }
            outboundPromptSource = (settings.outboundPromptSource as 'agent' | 'manual' | 'default') || 'default';
            outboundTemplateId = settings.outboundTemplateId || 'sales-orbitale';
            outboundAgentId = settings.outboundAgentId;
            outboundManualPrompt = settings.outboundManualPrompt || '';
            outboundBrandVoiceEnabled = settings.outboundBrandVoiceEnabled || false;
            outboundBrandVoiceAgentId = settings.outboundBrandVoiceAgentId || null;
            voiceThinkingBudget = settings.voiceThinkingBudgetGreeting ?? 0;
            voiceProtectFirstMessage = settings.voiceProtectFirstMessage ?? true;
            voiceDeferredPrompt = settings.voiceDeferredPrompt ?? false;
            voiceAffectiveDialog = settings.voiceAffectiveDialog ?? false;
            voiceVadStartSensitivity = settings.voiceVadStartSensitivity || 'START_SENSITIVITY_HIGH';
            voiceVadEndSensitivity = settings.voiceVadEndSensitivity || 'END_SENSITIVITY_LOW';
            if (!['START_SENSITIVITY_LOW', 'START_SENSITIVITY_HIGH'].includes(voiceVadStartSensitivity)) voiceVadStartSensitivity = 'START_SENSITIVITY_HIGH';
            if (!['END_SENSITIVITY_LOW', 'END_SENSITIVITY_HIGH'].includes(voiceVadEndSensitivity)) voiceVadEndSensitivity = 'END_SENSITIVITY_LOW';
            voiceVadSilenceMs = settings.voiceVadSilenceMs ?? 500;
            console.log(`📞 [${connectionId}] OUTBOUND settings loaded - source=${outboundPromptSource}, template=${outboundTemplateId}, brandVoice=${outboundBrandVoiceEnabled}, deferredPrompt=${voiceDeferredPrompt}, affectiveDialog=${voiceAffectiveDialog}, thinkingBudget=${voiceThinkingBudget}`);
            console.log(`🔍 [ROUTING-DEBUG] ━━━ OUTBOUND SETTINGS (non-client path) ━━━`);
            console.log(`🔍 [ROUTING-DEBUG]   consultantId used for query: ${consultantId}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundPromptSource: ${outboundPromptSource}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundTemplateId: ${outboundTemplateId}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundAgentId: ${outboundAgentId || 'null'}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundManualPrompt: ${outboundManualPrompt ? outboundManualPrompt.substring(0, 50) + '...' : 'empty'}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundBrandVoiceEnabled: ${outboundBrandVoiceEnabled}`);
            console.log(`🔍 [ROUTING-DEBUG]   outboundBrandVoiceAgentId: ${outboundBrandVoiceAgentId || 'null'}`);
            console.log(`🔍 [ROUTING-DEBUG]   nonClientPromptSource: ${settings.nonClientPromptSource || 'N/A'}`);
            console.log(`🔍 [ROUTING-DEBUG]   nonClientAgentId: ${settings.nonClientAgentId || 'null'}`);
            console.log(`🔍 [ROUTING-DEBUG]   nonClientManualPrompt: ${settings.nonClientManualPrompt ? settings.nonClientManualPrompt.substring(0, 50) + '...' : 'empty'}`);
            console.log(`🔍 [ROUTING-DEBUG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          }
          
          // Use consultant's voice directives or fallback to default
          const voiceDirectivesSection = consultantVoiceDirectives || `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ TONO E STILE - SEMPRE ENERGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ Mantieni SEMPRE un tono allegro, energico e dinamico!
🎯 Sii diretta e vai al punto - niente giri di parole
💬 DAI DEL TU sempre, mai del Lei
😊 Usa un linguaggio colloquiale e amichevole
🚫 NO suoni tipo "Mmm", "Uhm", "Ehm", "Ah"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎤 STILE VOCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• Parla in italiano fluente e naturale
• Voce vivace e coinvolgente
• Ritmo sostenuto ma comprensibile
• Entusiasmo genuino

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 REGOLE OBBLIGATORIE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❓ UNA DOMANDA ALLA VOLTA:
- FAI UNA SOLA DOMANDA, poi STOP - aspetta risposta
- MAI fare 2 domande di fila tipo "Di cosa ti occupi? E qual è il problema?"

🏢 USA I DATI DEL CONTESTO BUSINESS:
- Se hai info sul business → USALE, non inventare frasi generiche
- Cita SERVIZI, TARGET, USP specifici se li conosci

🚫 NON CHIEDERE "TI INTERESSA?":
- MAI "ti interessa?", "vuoi saperne?", "ti va?"
- DAI PER SCONTATO che interessa - stai chiamando TU`;
          
          // Build instruction type label
          const instructionTypeLabel = phoneInstructionType === 'task' ? '📋 TASK' : 
                                        phoneInstructionType === 'reminder' ? '⏰ PROMEMORIA' : '🎯 ISTRUZIONE';
          
          const _instructionBrandVoicePromise = (outboundBrandVoiceEnabled && outboundBrandVoiceAgentId)
            ? buildBrandVoiceFromAgent(outboundBrandVoiceAgentId)
            : Promise.resolve('');
          
          // ⚡ LOAD PREVIOUS CONVERSATIONS (pre-started in parallel)
          const MAX_HISTORY_CHARS = 8000;
          let instructionPreviousCallContext = '';
          let instructionHasPreviousConversations = false;
          if (phoneCallerId) {
            try {
              const previousConversations = await _previousConversationsPromise;
              _ncLatency.previousConversationsResolvedTime = Date.now();
              _ncLatency.previousConversationsDbRows = previousConversations.rows.length;
              console.log(`⏱️ [NC-LATENCY] previousConversations resolved (instruction path): +${_ncLatency.previousConversationsResolvedTime - _ncParallelStart}ms (${previousConversations.rows.length} rows)`);
              
              if (previousConversations.rows.length > 0) {
                instructionHasPreviousConversations = true;
                let historyContent = '';
                let includedConvCount = 0;
                
                for (const conv of previousConversations.rows as any[]) {
                  let convText = '';
                  const callDate = new Date(conv.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  convText += `📅 Chiamata del ${callDate}\n`;
                  convText += `Titolo: ${conv.title || 'Conversazione vocale'}\n\n`;
                  
                  if (conv.messages && Array.isArray(conv.messages)) {
                    for (const msg of conv.messages) {
                      const roleLabel = msg.role === 'user' ? '👤 Loro' : '🤖 Tu';
                      const msgContent = msg.role === 'assistant' ? stripAiThinking(msg.content) : msg.content;
                      convText += `${roleLabel}: ${msgContent}\n`;
                    }
                  }
                  convText += '\n---\n\n';
                  
                  // Check if adding this conversation would exceed limit
                  if (historyContent.length + convText.length > MAX_HISTORY_CHARS) {
                    break;
                  }
                  
                  historyContent += convText;
                  includedConvCount++;
                }
                
                if (historyContent.length > 0) {
                  console.log(`📱 [${connectionId}] Included ${includedConvCount} conversations (${historyContent.length} chars) for instruction call`);
                  
                  instructionPreviousCallContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI (CONTESTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai già parlato con questa persona! Usa queste info per essere più personale:

${historyContent}
💡 Usa queste info per salutare per nome e fare riferimento a conversazioni passate!
`;
                }
              } else {
                instructionHasPreviousConversations = false;
                console.log(`📱 [${connectionId}] No previous conversations found for ${phoneCallerId}`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not load previous conversations for instruction call:`, err);
            }
          }
          
          // 📊 LOG SCENARIO TABLE FOR NON-CLIENT WITH INSTRUCTION - DEFERRED to avoid blocking critical path
          const _deferredInstrHasPrevConvs = instructionHasPreviousConversations;
          const _deferredInstrType = phoneInstructionType;
          const _deferredCallerId = phoneCallerId;
          setImmediate(() => {
            console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
            console.log(`│           📊 SCENARIO DETECTION: NON-CLIENT WITH INSTRUCTION        │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ Parametro                    │ Valore                              │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ È cliente registrato?        │ ❌ NO                                │`);
            console.log(`│ Ha istruzione (task/remind)? │ ✅ SÌ (${(_deferredInstrType || 'generic').padEnd(10)})              │`);
            console.log(`│ Conversazioni precedenti?    │ ${_deferredInstrHasPrevConvs ? '✅ SÌ' : '❌ NO'}                               │`);
            console.log(`│ Caller ID                    │ ${(_deferredCallerId || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 🎯 SCENARIO                  │ OUTBOUND NON-CLIENT + TASK/REMINDER │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 💬 COMPORTAMENTO ATTESO:                                            │`);
            if (_deferredInstrHasPrevConvs) {
              console.log(`│   → Saluto informale (lo/la conosce già!)                          │`);
              console.log(`│   → NON si presenta ("Ciao! Come stai?")                           │`);
              console.log(`│   → Va dritto all'istruzione                                        │`);
            } else {
              console.log(`│   → Si presenta brevemente ("Sono Alessia di...")                   │`);
              console.log(`│   → Poi va dritto all'istruzione                                    │`);
            }
            console.log(`└─────────────────────────────────────────────────────────────────────┘\n`);
          });
          
          // Build dynamic greeting based on previous conversations
          const instructionGreetingSection = instructionHasPreviousConversations 
            ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 SALUTO INIZIALE (LI CONOSCI GIÀ!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANTE: Hai GIÀ parlato con questa persona! NON ripresentarti!

✅ SALUTI CORRETTI (calorosi, informali):
- "Ciao! Come stai? Senti, ti stavo chiamando perché..."
- "Ehi ciao! Tutto bene? Allora, ti volevo avvisare che..."
- "Ciao! Ti disturbo un attimo? Ti chiamo veloce perché..."

🚫 NON DIRE MAI:
- "Ciao sono Alessia..." (sanno già chi sei!)
- "Sono l'assistente di..." (sanno già chi sei!)
- Qualsiasi presentazione formale

📞 FLUSSO VELOCE:
1️⃣ Saluto breve → 2️⃣ VAI DRITTO all'istruzione → 3️⃣ Conferma e chiudi`
            : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 SALUTO INIZIALE (PRIMA INTERAZIONE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questa è la prima volta che parli con questa persona.
Presentati brevemente e poi vai dritto all'istruzione.

📞 FLUSSO DELLA CHIAMATA:

1️⃣ SALUTO + BREVE PRESENTAZIONE:
   "Ciao! Sono Alessia, ti chiamo da parte di ${consultantName}. Come stai?"
   
2️⃣ CHIACCHIERATA BREVE (dopo che rispondono):
   Rispondi al loro "come stai" - "Fantastico! Anch'io benissimo!" o simile
   
3️⃣ INTRODUCI L'ISTRUZIONE IN MODO NATURALE:
   "Senti, ti stavo chiamando perché..." 
   
4️⃣ CONFERMA E CHIUDI`;
          
          let outboundInstructionBrandVoiceSection = '';
          outboundInstructionBrandVoiceSection = await _instructionBrandVoicePromise;
          if (outboundInstructionBrandVoiceSection) {
            _ncLatency.brandVoiceResolvedTime = Date.now();
            _ncLatency.brandVoiceChars = outboundInstructionBrandVoiceSection.length;
            console.log(`🏢 [${connectionId}] Brand Voice loaded for OUTBOUND instruction (${outboundInstructionBrandVoiceSection.length} chars)`);
            console.log(`⏱️ [NC-LATENCY] brandVoice resolved (instruction path): +${_ncLatency.brandVoiceResolvedTime - _ncParallelStart}ms`);
          }
          
          // Build prompt with: VOICE DIRECTIVES FIRST + BRAND VOICE + IDENTITY + DETAILED PROFILE + LEAD CONTEXT + INSTRUCTION + GREETING + CALL HISTORY
          systemInstruction = `${voiceDirectivesSection}
${outboundInstructionBrandVoiceSection ? '\n' + outboundInstructionBrandVoiceSection + '\n' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 CHI SEI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sei Alessia, l'assistente AI di ${consultantName}${consultantBusinessName ? ` (${consultantBusinessName})` : ''}.
Stai chiamando per conto del consulente.
${consultantDetailedProfileSection ? '\n' + consultantDetailedProfileSection : ''}
${phoneCallLeadContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 INFORMAZIONI SUL LEAD CHE STAI CHIAMANDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${phoneCallLeadContext}
` : hunterContextBlock ? `
${hunterContextBlock}
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IL TUO COMPITO PER QUESTA CHIAMATA - VAI DRITTO AL PUNTO!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${instructionTypeLabel}:
${phoneCallInstruction}

⚠️ PRIORITÀ: Comunica questa istruzione in modo naturale ma DIRETTO!
Non fare giri di parole, vai al punto rapidamente dopo il saluto.

${instructionGreetingSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 CONTESTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data e ora: ${italianTime} (Italia)
Tipo chiamata: OUTBOUND con ${instructionHasPreviousConversations ? 'persona già conosciuta' : 'nuova persona'}
${leadContactData.leadId ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 DATI CHIAMANTE (dal CRM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Telefono: ${leadContactData.phone || phoneCallerId}${leadContactData.name ? `\n• Nome: ${leadContactData.name}` : ''}${leadContactData.email ? `\n• Email: ${leadContactData.email}` : ''}${leadContactData.category ? `\n• Categoria: ${leadContactData.category}` : ''}

⚡ Se proponi appuntamento, usa questi dati e chiedi conferma (NON chiedere dati che hai già!)` : phoneCallerId ? `
📱 Telefono chiamante: ${phoneCallerId}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DOPO CHE L'ISTRUZIONE È COMPLETATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Una volta che hanno capito e confermato:
• Chiedere "C'è qualcos'altro di cui hai bisogno?"
• Se no, saluta cordialmente "Perfetto allora! Buona giornata!"
• Proponi appuntamento con ${consultantName} solo se appropriato`;

          if (instructionPreviousCallContext) {
            _ncLatency.deferredCallHistory = instructionPreviousCallContext;
            console.log(`📚 [${connectionId}] Call history DEFERRED from system_instruction (${instructionPreviousCallContext.length} chars) → will be sent after greeting`);
          }

          _ncLatency.promptBuildDoneTime = Date.now();
          _ncLatency.hasInstruction = true;
          _ncLatency.hasCallHistory = !!instructionPreviousCallContext;
          _ncLatency.callDirection = 'OUTBOUND';
          _ncLatency.promptSource = outboundPromptSource;
          _ncLatency.voiceDirectivesChars = voiceDirectivesSection.length;
          _ncLatency.contentPromptChars = 0;
          _ncLatency.previousCallContextChars = instructionPreviousCallContext?.length || 0;
          _ncLatency.previousConversationsCount = instructionHasPreviousConversations ? _ncLatency.previousConversationsDbRows : 0;
          console.log(`⏱️ [NC-LATENCY] Prompt build done (instruction path): +${_ncLatency.promptBuildDoneTime - _ncParallelStart}ms`);
          console.log(`📏 [NC-CONTEXT] Components: voiceDirectives=${_ncLatency.voiceDirectivesChars} | brandVoice=${_ncLatency.brandVoiceChars} | callHistory=${_ncLatency.previousCallContextChars} | TOTAL systemInstruction=${systemInstruction.length} chars (~${Math.round(systemInstruction.length / 4)} tokens)`);

          userDataContext = '';
          console.log(`🎯 [${connectionId}] Instruction prompt built (${systemInstruction.length} chars)${instructionPreviousCallContext ? ' [CALL HISTORY DEFERRED]' : ''}`);
          
          // 🔥 PRINT FULL PROMPT FOR DEBUGGING - DEFERRED to avoid blocking critical path
          const _deferredInstructionPromptLog = systemInstruction;
          setImmediate(() => {
            console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🎯 FULL INSTRUCTION PROMPT:`);
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(_deferredInstructionPromptLog);
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          });
        } else {
          // No specific instruction - continue with normal non-client prompt flow (INBOUND)
        
        // Load non-client settings from database (includes both legacy and new direction-specific fields)
        let voiceDirectives = '';
        // Direction-specific settings (new template system)
        let promptSource: 'agent' | 'manual' | 'template' | 'default' = 'template';
        let templateId: string = 'mini-discovery'; // Default INBOUND template
        let agentId: string | null = null;
        let manualPrompt = '';
        // Brand Voice settings for INBOUND and OUTBOUND
        let inboundBrandVoiceEnabled = false;
        let inboundBrandVoiceAgentId: string | null = null;
        let outboundBrandVoiceEnabled = false;
        let outboundBrandVoiceAgentId: string | null = null;
        
        // 🎯 FIX: Determine direction based on scheduledCallId FORMAT
        // OUTBOUND calls from Replit have scheduledCallId starting with "sc_" (e.g. sc_1770317815932_p4nhuqjl3)
        // AI-initiated callbacks have voiceCallId starting with "outbound-"
        // INBOUND calls use FreeSWITCH UUID format (e.g. 005ce2b3-cfd7-45ff-9b9b-ae0e979ec5dd)
        const isOutbound = (!!phoneScheduledCallId && phoneScheduledCallId.startsWith('sc_')) || (!!phoneVoiceCallId && phoneVoiceCallId.startsWith('outbound-'));
        
        console.log(`📞 [${connectionId}] DIRECTION DETECTION: scheduledCallId=${phoneScheduledCallId}, voiceCallId=${phoneVoiceCallId || 'N/A'}, isOutbound=${isOutbound}`);
        
        // ⚡ Await pre-started settings promise (runs in parallel with other queries)
        {
          const settingsResult = await _settingsPromise;
          _ncLatency.settingsResolvedTime = Date.now();
          console.log(`⏱️ [NC-LATENCY] settings resolved (non-instruction path): +${_ncLatency.settingsResolvedTime - _ncParallelStart}ms`);
          if (settingsResult.length > 0) {
            const settings = settingsResult[0] as any;
            voiceDirectives = settings.voiceDirectives || '';
            
            inboundBrandVoiceEnabled = settings.inboundBrandVoiceEnabled || false;
            inboundBrandVoiceAgentId = settings.inboundBrandVoiceAgentId || null;
            outboundBrandVoiceEnabled = settings.outboundBrandVoiceEnabled || false;
            outboundBrandVoiceAgentId = settings.outboundBrandVoiceAgentId || null;
            voiceThinkingBudget = settings.voiceThinkingBudgetGreeting ?? 0;
            voiceProtectFirstMessage = settings.voiceProtectFirstMessage ?? true;
            voiceDeferredPrompt = settings.voiceDeferredPrompt ?? false;
            voiceAffectiveDialog = settings.voiceAffectiveDialog ?? false;
            voiceVadStartSensitivity = settings.voiceVadStartSensitivity || 'START_SENSITIVITY_HIGH';
            voiceVadEndSensitivity = settings.voiceVadEndSensitivity || 'END_SENSITIVITY_LOW';
            if (!['START_SENSITIVITY_LOW', 'START_SENSITIVITY_HIGH'].includes(voiceVadStartSensitivity)) voiceVadStartSensitivity = 'START_SENSITIVITY_HIGH';
            if (!['END_SENSITIVITY_LOW', 'END_SENSITIVITY_HIGH'].includes(voiceVadEndSensitivity)) voiceVadEndSensitivity = 'END_SENSITIVITY_LOW';
            voiceVadSilenceMs = settings.voiceVadSilenceMs ?? 500;
            
            if (isOutbound) {
              const rawOutboundSource = settings.outboundPromptSource || settings.nonClientPromptSource || 'template';
              promptSource = (rawOutboundSource === 'default' ? 'template' : rawOutboundSource) as 'agent' | 'manual' | 'template';
              templateId = settings.outboundTemplateId || 'sales-orbitale';
              agentId = settings.outboundAgentId || settings.nonClientAgentId;
              manualPrompt = settings.outboundManualPrompt || settings.nonClientManualPrompt || '';
              
              console.log(`📞 [${connectionId}] OUTBOUND non-client call - source=${promptSource}, template=${templateId}, agentId=${agentId}, brandVoice=${outboundBrandVoiceEnabled}`);
            } else {
              const rawInboundSource = settings.inboundPromptSource || settings.nonClientPromptSource || 'template';
              promptSource = (rawInboundSource === 'default' ? 'template' : rawInboundSource) as 'agent' | 'manual' | 'template';
              templateId = settings.inboundTemplateId || 'mini-discovery';
              agentId = settings.inboundAgentId || settings.nonClientAgentId;
              manualPrompt = settings.inboundManualPrompt || settings.nonClientManualPrompt || '';
              
              console.log(`📞 [${connectionId}] INBOUND non-client call - source=${promptSource}, template=${templateId}, agentId=${agentId}, brandVoice=${inboundBrandVoiceEnabled}`);
            }
          }
        }
        
        const _nonInstructionBrandVoicePromise = (() => {
          if (isOutbound && outboundBrandVoiceEnabled && outboundBrandVoiceAgentId) {
            return buildBrandVoiceFromAgent(outboundBrandVoiceAgentId);
          } else if (!isOutbound && inboundBrandVoiceEnabled && inboundBrandVoiceAgentId) {
            return buildBrandVoiceFromAgent(inboundBrandVoiceAgentId);
          }
          return Promise.resolve('');
        })();
        
        // Helper to interpolate placeholders (supports both {{mustache}} and ${javascript} styles)
        // Note: This is for DEFAULT prompts only. Agent instructions use their own interpolation.
        const interpolatePlaceholders = (text: string): string => {
          return text
            // Mustache style {{placeholder}}
            .replace(/\{\{consultantName\}\}/g, consultantName)
            .replace(/\{\{businessName\}\}/g, consultantBusinessName ? ` (${consultantBusinessName})` : '');
        };
        
        // Default voice directives template - using Google's Director's Notes framework
        const DEFAULT_VOICE_DIRECTIVES = `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 DIRECTOR'S NOTES - MANTENERE ENERGIA TUTTA LA CHIAMATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎭 LA SCENA:
Sei in piedi in uno studio luminoso, ti muovi con energia.
C'è musica di sottofondo che ti carica.
Hai appena bevuto un caffè e sei al massimo dell'energia!

🎤 STILE VOCALE - "Vocal Smile":
- FAI SENTIRE IL SORRISO in ogni parola!
- Consonanti PUNCHY e decise
- Allunga le vocali sulle parole di entusiasmo ("Fantasticooo!")
- Tono ALTO e luminoso, mai monotono
- Proiezione alta senza urlare

🚀 ATTACCO VOCALE - "Prima Parola Squillante":
- La PRIMISSIMA parola che pronunci DEVE essere ALTA, squillante, piena di energia!
- Attacca come se stessi rispondendo a un amico che non senti da mesi: "CIAO!" forte e luminoso
- MAI partire con tono piatto, sommesso o esitante — la prima sillaba deve ESPLODERE di energia
- Immagina di alzare il volume al massimo sulla prima parola, poi mantieni alto

⚡ ENERGIA - "Infectious Enthusiasm":
- Entusiasmo CONTAGIOSO dall'inizio alla fine
- Bouncing with energy - come se stessi saltellando!
- NON calare MAI il tono durante la conversazione
- Ogni risposta deve avere la STESSA carica della prima

🎵 RITMO:
- Pacing VELOCE ed energico
- Transizioni rapide tra argomenti
- Pause brevi e incisive, mai lunghe e noiose

🚫 TONO INFORMALE - REGOLE OBBLIGATORIE:
- USA SEMPRE "Ciao!" - MAI "Buongiorno" o "Buonasera"
- DAI SEMPRE DEL TU - MAI del Lei
- Parla come un AMICO carico di energia!

📏 LUNGHEZZA RISPOSTE - ADATTATI ALLA RICHIESTA:
- Se l'utente dice "parla tanto", "spiegami meglio", "dimmi di più", "vai nel dettaglio":
  → PARLA A LUNGO! Fai spiegazioni complete e approfondite (anche 2-3 minuti)
  → Non fermarti dopo 2 frasi, continua con esempi, dettagli, storie
- Se l'utente fa una domanda breve o vuole una risposta rapida:
  → Rispondi in modo più conciso
- REGOLA D'ORO: Dai all'utente quello che chiede!

🚨 REGOLE CONVERSAZIONE NATURALE - OBBLIGATORIE:

❓ UNA DOMANDA ALLA VOLTA (CRITICO!):
- FAI UNA SOLA DOMANDA, poi STOP TOTALE - aspetta risposta
- MAI MAI MAI fare 2 domande di fila tipo "Di cosa ti occupi? E qual è il problema?"
- Se vuoi sapere più cose → PRIMA una, ASPETTA, POI l'altra
- Ogni turno = UNA domanda massimo, poi SILENZIO

🏢 USA I DATI DEL CONTESTO BUSINESS (OBBLIGATORIO!):
- Se hai ricevuto info su cosa fa il business (es: "aiutiamo imprenditori SaaS", "gestiamo AI per agenzie")
  → DEVI usare ESATTAMENTE quei dati, non inventare frasi generiche
- MAI dire "migliorare il tuo business" generico se sai COSA fanno
- Cita i SERVIZI SPECIFICI, il TARGET SPECIFICO, l'USP SPECIFICO
- Esempio SBAGLIATO: "aiutiamo a migliorare il business"
- Esempio GIUSTO: "aiutiamo imprenditori con SaaS a gestire i lead con un Dipendente AI"

🚫 NON CHIEDERE "TI INTERESSA?" - DAI PER SCONTATO:
- MAI dire "ti interessa?", "vuoi saperne di più?", "ti va di parlarne?"
- DAI PER SCONTATO che gli interessa - stai chiamando TU
- Invece di chiedere → VAI DRITTO: "Dimmi, di cosa ti occupi esattamente?"
- L'interesse lo dai per acquisito, tu stai offrendo valore

📜 INTERPRETA, NON LEGGERE:
- Gli script e le frasi che vedi sono TRACCE, non testi da leggere
- Capisci il CONCETTO e dillo CON PAROLE TUE
- Parla come parleresti davvero, non come un robot che legge
- Adatta il linguaggio alla persona che hai davanti
- Varia le parole, non ripetere sempre le stesse frasi

⚠️ OBIEZIONI - SOLO SE ARRIVANO:
- Le frasi per gestire obiezioni (es: "30 secondi", "neanche a me interesserebbe...")
  le usi SOLO SE la persona OBIETTA davvero
- NON prevenire obiezioni che non esistono
- Prima ascolta, poi rispondi se serve`;
        
        // Default non-client prompt template
        const DEFAULT_NON_CLIENT_PROMPT = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IL TUO RUOLO E IDENTITÀ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sei Alessia, l'assistente AI vocale di {{consultantName}}{{businessName}}.
Chi ti chiama NON è un cliente registrato.
Il tuo obiettivo è:
1. Capire chi sta chiamando e cosa cerca
2. Fare una mini-discovery per capire le sue esigenze
3. Se appropriato, proporre un appuntamento con {{consultantName}}

⚠️ LA TUA IDENTITÀ (usa questa frase se ti chiedono chi sei):
"Sono Alessia, l'assistente digitale di {{consultantName}}. Faccio parte del suo team e aiuto i clienti nel loro percorso."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 COMPORTAMENTO INIZIALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ REGOLA IMPORTANTE:
Se nelle CONVERSAZIONI PRECEDENTI (sotto) conosci già il nome della persona:
- Ti ricordi di lei! NON presentarti di nuovo
- Salutala per nome: "Ehi [nome]! Che bello risentirti!"

Se invece è la PRIMA chiamata (nessuna conversazione precedente):
- Presentati: "Ciao! Sono Alessia, l'assistente di {{consultantName}}. Con chi parlo?"`;
        
        // Add remaining sections to the prompt
        const NON_CLIENT_PROMPT_SUFFIX = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 MINI-DISCOVERY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Dopo il saluto, fai domande per capire:
1. Come hanno trovato il numero (referral, web, passaparola?)
2. Cosa cercano o di cosa hanno bisogno
3. Se hanno già lavorato con un consulente

Esempi di domande:
- "Come hai trovato il nostro numero?"
- "Raccontami un po', cosa ti ha spinto a chiamare oggi?"
- "C'è qualcosa di specifico su cui vorresti lavorare?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 PROPORRE APPUNTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando appropriato, proponi di fissare una consulenza:
- "Sai cosa? Mi sembra che potresti beneficiare di una chiacchierata con {{consultantName}}. Che ne dici se fissiamo un appuntamento?"
- "Questo è proprio il tipo di cosa in cui possiamo aiutarti! Ti va di prenotare una consulenza per approfondire?"

Se accettano, chiedi:
- Email per il contatto
- Preferenza di giorno/orario
- Numero di telefono se diverso da quello che stanno usando

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SEI ANCHE UN'AI GENERALISTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Puoi rispondere anche a domande generali.
Non devi rifiutarti di aiutare - dai valore anche senza dati specifici!`;
        
        // Use custom voice directives or default
        const finalVoiceDirectives = voiceDirectives || DEFAULT_VOICE_DIRECTIVES;
        
        // Placeholder for content prompt - will be built after extracting caller name
        let contentPrompt = '';
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ⚡ LOAD PREVIOUS CONVERSATIONS (pre-started in parallel)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const INBOUND_MAX_HISTORY_CHARS = 8000;
        let previousCallContext = '';
        let extractedContactName = '';
        if (phoneCallerId) {
          try {
            const previousConversations = await _previousConversationsPromise;
            _ncLatency.previousConversationsResolvedTime = Date.now();
            _ncLatency.previousConversationsDbRows = previousConversations.rows.length;
            console.log(`⏱️ [NC-LATENCY] previousConversations resolved (non-instruction path): +${_ncLatency.previousConversationsResolvedTime - _ncParallelStart}ms (${previousConversations.rows.length} rows)`);
            
            if (previousConversations.rows.length > 0) {
              let historyContent = '';
              let includedConvCount = 0;
              
              for (const conv of previousConversations.rows as any[]) {
                let convText = '';
                const callDate = new Date(conv.created_at).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                
                convText += `📅 Chiamata del ${callDate}\n`;
                convText += `Titolo: ${conv.title || 'Conversazione vocale'}\n\n`;
                
                if (conv.messages && Array.isArray(conv.messages)) {
                  for (const msg of conv.messages) {
                    const roleLabel = msg.role === 'user' ? '👤 Chiamante' : '🤖 Tu';
                    const msgContent = msg.role === 'assistant' ? stripAiThinking(msg.content) : msg.content;
                    convText += `${roleLabel}: ${msgContent}\n`;
                  }
                }
                convText += '\n---\n\n';
                
                if (historyContent.length + convText.length > INBOUND_MAX_HISTORY_CHARS) {
                  break;
                }
                
                historyContent += convText;
                includedConvCount++;
              }
              
              if (historyContent.length > 0) {
                console.log(`📱 [${connectionId}] Included ${includedConvCount} conversations (${historyContent.length} chars) for inbound call`);
                
                // 🆕 Estrai il nome del contatto dallo storico (cerca pattern "Ciao [Nome]" o "con [Nome]")
                const namePatterns = [
                  /Ciao\s+([A-Z][a-zàèéìòù]+)/,  // "Ciao Marco"
                  /con\s+([A-Z][a-zàèéìòù]+)/,   // "con Marco"
                  /(?:Chiamante|Tu):\s*(?:Sono|Mi chiamo)\s+([A-Z][a-zàèéìòù]+)/i  // "Sono Marco"
                ];
                
                for (const pattern of namePatterns) {
                  const match = historyContent.match(pattern);
                  if (match && match[1]) {
                    extractedContactName = match[1];
                    console.log(`📛 [${connectionId}] Extracted contact name from history: "${extractedContactName}"`);
                    break;
                  }
                }
                
                // 🆕 Costruisci istruzioni DIVERSE per OUTBOUND vs INBOUND
                if (isOutbound) {
                  // OUTBOUND: storico per continuità + contesto
                  previousCallContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 NOME DEL CONTATTO: ${extractedContactName || '(sconosciuto)'}

🔄 USA LO STORICO PER DECIDERE COME INIZIARE:
→ Lo script ha una sezione "CONTINUITÀ CONVERSAZIONE" - SEGUILA!
→ Analizza lo storico qui sotto per capire:
  1. Se c'è già un appuntamento preso → menzionalo e offri gestione (modifica/sposta/aggiungi email)
  2. A che punto eravate arrivati → riprendi da lì, NON ricominciare da zero
  3. Il nome della persona → usalo nel saluto
  4. Argomenti già discussi → non ripetere domande già fatte

⚠️ REGOLA: Se lo storico mostra conversazioni precedenti → adatta il saluto!
→ Con persona già conosciuta: "Ciao [Nome]! Come stai? Ti richiamo perché..."
→ Con appuntamento esistente: "Ciao [Nome]! Tutto confermato per [DATA]?"
→ SOLO se prima volta → usa l'apertura standard dello script

Ecco le conversazioni precedenti:

${historyContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                } else if (promptSource === 'template') {
                  // INBOUND + TEMPLATE: storico per continuità + contesto
                  previousCallContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📛 NOME DEL CONTATTO: ${extractedContactName || '(sconosciuto)'}

🔄 USA LO STORICO PER DECIDERE DA DOVE PARTIRE:
→ Il template ha una sezione "CONTINUITÀ CONVERSAZIONE" - SEGUILA!
→ Analizza lo storico qui sotto per capire:
  1. Se c'è già un appuntamento preso → offri gestione (modifica/sposta/aggiungi email)
  2. A che FASE eravamo arrivati → riprendi da lì, NON da FASE 1
  3. Il nome della persona → saluta per nome
  4. Argomenti già discussi → non ripetere domande già fatte

⚠️ REGOLA FONDAMENTALE:
→ Se lo storico mostra che conoscete già questa persona → NON ricominciare da zero!
→ Se c'è un appuntamento → chiedi se serve modificare qualcosa
→ Se eravate a metà conversazione → riprendi da dove eravate rimasti
→ SOLO se non c'è storico → parti da FASE 1

Ecco le conversazioni precedenti:

${historyContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                } else {
                  // INBOUND + NO TEMPLATE (default/assistenza): saluto caloroso per returning caller
                  previousCallContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨🚨🚨 REGOLA CRITICA - SALUTO IMMEDIATO CON NOME 🚨🚨🚨

Se nelle conversazioni sotto vedi un nome (es. "Marco", "Laura"):
→ PRIMA PAROLA del saluto DEVE essere: "Ciao [Nome]!"
→ Esempio CORRETTO: "Ciao Marco! Che bello risentirti!"
→ Esempio SBAGLIATO: "Ciao! Ti ricordi di me? Sei Marco?"

⛔ NON DIRE MAI:
- "Ti ricordi?" 
- "Ci siamo già sentiti?"
- "Sei tu [Nome]?"

✅ SALUTA DIRETTAMENTE PER NOME - TU SAI GIÀ CHI È!

🎯 COMPORTAMENTO:
- Sii CALOROSO e ACCOGLIENTE
- Fai capire che ti ricordi: "L'ultima volta parlavamo di..."

📝 NOTA: Mantieni sempre la TUA identità (come definita nelle tue istruzioni principali). Puoi ricordare la persona senza cambiare chi sei.

Ecco le conversazioni precedenti:

${historyContent}
💡 USA ATTIVAMENTE queste informazioni per:
- Salutare per nome se lo conosci
- Fare riferimento a conversazioni passate
- Far sentire la persona RICONOSCIUTA e SPECIALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
                }
              }
            } else {
              console.log(`📱 [${connectionId}] No previous conversations found for caller ${phoneCallerId}`);
            }
          } catch (err) {
            console.warn(`⚠️ [${connectionId}] Could not load previous caller conversations:`, err);
          }
        }
        
        const PLACEHOLDER_NAMES = ['contatto', 'cliente', 'unknown', 'sconosciuto', 'lead', 'lead sconosciuto', ''];
        if (!extractedContactName && leadContactData.name && !PLACEHOLDER_NAMES.includes(leadContactData.name.trim().toLowerCase())) {
          extractedContactName = leadContactData.name;
        }
        if (extractedContactName && PLACEHOLDER_NAMES.includes(extractedContactName.trim().toLowerCase())) {
          extractedContactName = '';
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BUILD CONTENT PROMPT (after extracting caller name)
        // Uses direction-specific settings: promptSource, templateId, agentId, manualPrompt
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (promptSource === 'agent' && agentId) {
          // Load agent prompt from consultant_whatsapp_config table (the real WhatsApp agents)
          try {
            const agentResult = await db.execute(sql`
              SELECT 
                agent_instructions,
                COALESCE(agent_name, business_name) as name,
                business_name,
                business_description,
                consultant_bio,
                consultant_display_name,
                vision,
                mission,
                values,
                usp,
                who_we_help,
                who_we_dont_help,
                what_we_do,
                how_we_do_it,
                services_offered,
                guarantees,
                years_experience,
                clients_helped,
                results_generated,
                case_studies,
                software_created,
                books_published,
                ai_personality
              FROM consultant_whatsapp_config 
              WHERE id = ${agentId}
            `);
            
            if (agentResult.rows.length > 0) {
              const agent = agentResult.rows[0] as any;
              voiceAgentName = agent.agent_name || agent.name || null;
              
              // Build comprehensive prompt with Brand Voice data
              let brandVoicePrompt = '';
              
              // Core identity
              if (agent.business_name) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏢 BUSINESS & IDENTITÀ\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                brandVoicePrompt += `• Business: ${agent.business_name}\n`;
                if (agent.consultant_display_name) brandVoicePrompt += `• Consulente: ${agent.consultant_display_name}\n`;
                if (agent.business_description) brandVoicePrompt += `• Descrizione: ${agent.business_description}\n`;
                if (agent.consultant_bio) brandVoicePrompt += `• Bio: ${agent.consultant_bio}\n`;
              }
              
              // Vision, Mission, Values, USP
              if (agent.vision || agent.mission || agent.usp) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 POSIZIONAMENTO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                if (agent.vision) brandVoicePrompt += `• Vision: ${agent.vision}\n`;
                if (agent.mission) brandVoicePrompt += `• Mission: ${agent.mission}\n`;
                if (agent.values && Array.isArray(agent.values) && agent.values.length > 0) {
                  brandVoicePrompt += `• Valori: ${agent.values.join(', ')}\n`;
                }
                if (agent.usp) brandVoicePrompt += `• USP: ${agent.usp}\n`;
              }
              
              // Target audience
              if (agent.who_we_help || agent.who_we_dont_help) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👥 TARGET\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                if (agent.who_we_help) brandVoicePrompt += `• Chi aiutiamo: ${agent.who_we_help}\n`;
                if (agent.who_we_dont_help) brandVoicePrompt += `• Chi NON aiutiamo: ${agent.who_we_dont_help}\n`;
              }
              
              // What we do
              if (agent.what_we_do || agent.how_we_do_it) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔧 METODO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                if (agent.what_we_do) brandVoicePrompt += `• Cosa facciamo: ${agent.what_we_do}\n`;
                if (agent.how_we_do_it) brandVoicePrompt += `• Come lo facciamo: ${agent.how_we_do_it}\n`;
              }
              
              // Credentials
              if (agent.years_experience || agent.clients_helped || agent.results_generated) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 CREDENZIALI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                if (agent.years_experience) brandVoicePrompt += `• Anni di esperienza: ${agent.years_experience}\n`;
                if (agent.clients_helped) brandVoicePrompt += `• Clienti aiutati: ${agent.clients_helped}\n`;
                if (agent.results_generated) brandVoicePrompt += `• Risultati: ${agent.results_generated}\n`;
              }
              
              // Services & Guarantees
              if (agent.services_offered && Array.isArray(agent.services_offered) && agent.services_offered.length > 0) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💼 SERVIZI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                for (const service of agent.services_offered) {
                  if (service.name) {
                    brandVoicePrompt += `• ${service.name}${service.price ? ` (${service.price})` : ''}\n`;
                    if (service.description) brandVoicePrompt += `  ${service.description}\n`;
                  }
                }
              }
              if (agent.guarantees) {
                brandVoicePrompt += `• Garanzie: ${agent.guarantees}\n`;
              }
              
              // AI Personality
              if (agent.ai_personality) {
                brandVoicePrompt += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🤖 PERSONALITÀ AI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                brandVoicePrompt += agent.ai_personality + '\n';
              }
              
              // Combine: agent_instructions (PRIORITY) + Brand Voice (supplementary context)
              if (agent.agent_instructions) {
                // Interpolate agent instructions with actual values from agent data
                const agentDisplayName = agent.name || 'Alessia';
                const toText = (val: any): string => {
                  if (!val) return '';
                  if (typeof val === 'string') return val;
                  if (Array.isArray(val)) return val.map((item: any) => typeof item === 'object' && item.name ? `${item.name}${item.description ? ': ' + item.description : ''}` : String(item)).join(', ');
                  return String(val);
                };
                const interpolateAgentInstructions = (text: string): string => {
                  return text
                    .replace(/\$\{consultantName\}/g, consultantName)
                    .replace(/\$\{businessName\}/g, agent.business_name || consultantBusinessName || '')
                    .replace(/\$\{whoWeHelp\}/g, toText(agent.who_we_help))
                    .replace(/\$\{businessDescription\}/g, agent.business_description || '')
                    .replace(/\$\{contactName\}/g, extractedContactName || '')
                    .replace(/\$\{firstName\}/g, extractedContactName || '')
                    .replace(/\$\{aiName\}/g, agentDisplayName)
                    .replace(/\$\{services\}/g, toText(agent.services_offered))
                    .replace(/\$\{targetAudience\}/g, toText(agent.who_we_help))
                    .replace(/\$\{usp\}/g, agent.usp || '')
                    .replace(/\$\{sector\}/g, agent.business_description || '')
                    .replace(/\{\{consultantName\}\}/g, consultantName)
                    .replace(/\{\{businessName\}\}/g, agent.business_name || consultantBusinessName || '')
                    .replace(/\{\{whoWeHelp\}\}/g, toText(agent.who_we_help))
                    .replace(/\{\{businessDescription\}\}/g, agent.business_description || '')
                    .replace(/\{\{contactName\}\}/g, extractedContactName || '')
                    .replace(/\{\{firstName\}\}/g, extractedContactName || '')
                    .replace(/\{\{aiName\}\}/g, agentDisplayName)
                    .replace(/\{\{services\}\}/g, toText(agent.services_offered))
                    .replace(/\{\{targetAudience\}\}/g, toText(agent.who_we_help))
                    .replace(/\{\{usp\}\}/g, agent.usp || '')
                    .replace(/\{\{sector\}\}/g, agent.business_description || '');
                };
                
                const interpolatedInstructions = interpolateAgentInstructions(agent.agent_instructions);
                
                // Agent instructions are the PRIMARY directives - must be followed precisely
                contentPrompt = `⚡ ISTRUZIONI PRINCIPALI (SEGUI QUESTE COME PRIORITÀ ASSOLUTA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 REGOLA FONDAMENTALE:
- Segui ESATTAMENTE il comportamento e il messaggio di apertura definiti nelle istruzioni sotto
- Se le istruzioni specificano un NOME per te, usa quello
- Se NON c'è un nome specifico nelle istruzioni, il tuo nome di default è "Alessia"

${interpolatedInstructions}

${brandVoicePrompt ? `
📋 CONTESTO SUPPLEMENTARE (informazioni di supporto)
Le seguenti informazioni sono di contorno per arricchire il contesto, ma le istruzioni sopra hanno la priorità.
${brandVoicePrompt}` : ''}`;
              } else {
                // No agent_instructions, use Brand Voice as context for default prompt
                contentPrompt = interpolatePlaceholders(DEFAULT_NON_CLIENT_PROMPT + NON_CLIENT_PROMPT_SUFFIX) + '\n\n' + brandVoicePrompt;
              }
              
              console.log(`📞 [${connectionId}] ${isOutbound ? 'OUTBOUND' : 'INBOUND'} - Using agent prompt: ${agent.name} (${contentPrompt.length} chars, includes Brand Voice)`);
            } else {
              console.warn(`⚠️ [${connectionId}] Agent ${agentId} not found, falling back to template`);
              // Fall back to template
              let template = getTemplateById(templateId);
              if (!template && templateId?.startsWith('custom:')) {
                const customId = templateId.replace('custom:', '');
                const ctRes = await db.execute(sql`SELECT name, prompt FROM consultant_voice_templates WHERE id = ${customId} LIMIT 1`);
                if (ctRes.rows.length > 0) template = { id: templateId, name: (ctRes.rows[0] as any).name, direction: isOutbound ? 'outbound' : 'inbound', description: '', prompt: (ctRes.rows[0] as any).prompt };
              }
              if (template) {
                contentPrompt = resolveTemplateVariables(template.prompt, {
                  consultantName: consultantName,
                  businessName: consultantBusinessName || '',
                  aiName: 'Alessia',
                  contactName: extractedContactName || ''
                });
                console.log(`📞 [${connectionId}] ${isOutbound ? 'OUTBOUND' : 'INBOUND'} - Using template: ${template.name} (${contentPrompt.length} chars) - contactName: "${extractedContactName || '(none)'}"`);
              } else {
                contentPrompt = interpolatePlaceholders(DEFAULT_NON_CLIENT_PROMPT + NON_CLIENT_PROMPT_SUFFIX);
              }
            }
          } catch (err) {
            console.warn(`⚠️ [${connectionId}] Could not fetch agent prompt:`, err);
            contentPrompt = interpolatePlaceholders(DEFAULT_NON_CLIENT_PROMPT + NON_CLIENT_PROMPT_SUFFIX);
          }
        } else if (promptSource === 'manual' && manualPrompt) {
          contentPrompt = interpolatePlaceholders(manualPrompt);
          console.log(`📞 [${connectionId}] ${isOutbound ? 'OUTBOUND' : 'INBOUND'} - Using manual prompt (${contentPrompt.length} chars)`);
        } else {
          let template = getTemplateById(templateId);
          if (!template && templateId?.startsWith('custom:')) {
            const customId = templateId.replace('custom:', '');
            const ctRes = await db.execute(sql`SELECT name, prompt FROM consultant_voice_templates WHERE id = ${customId} LIMIT 1`);
            if (ctRes.rows.length > 0) template = { id: templateId, name: (ctRes.rows[0] as any).name, direction: isOutbound ? 'outbound' : 'inbound', description: '', prompt: (ctRes.rows[0] as any).prompt };
          }
          if (template) {
            let profileServices = '';
            let profileTarget = '';
            let profileUsp = '';
            let profileSector = '';
            try {
              const profileResult = await db.execute(sql`
                SELECT services_offered, specializations, ideal_client_description, 
                       industries_served, unique_selling_proposition, geographic_focus,
                       methodology, professional_title, bio
                FROM consultant_detailed_profiles 
                WHERE consultant_id = ${consultantId} LIMIT 1
              `);
              if (profileResult.rows.length > 0) {
                const p = profileResult.rows[0] as any;
                if (p.services_offered || p.specializations) {
                  profileServices = `🔧 SERVIZI OFFERTI: ${p.services_offered || ''}${p.specializations ? ` | Specializzazioni: ${p.specializations}` : ''}${p.methodology ? ` | Metodo: ${p.methodology}` : ''}`;
                }
                if (p.ideal_client_description || p.industries_served) {
                  profileTarget = `🎯 TARGET: ${p.ideal_client_description || ''}${p.industries_served ? ` | Settori: ${p.industries_served}` : ''}${p.geographic_focus ? ` | Area: ${p.geographic_focus}` : ''}`;
                }
                if (p.unique_selling_proposition) {
                  profileUsp = `💎 PROPOSTA UNICA DI VALORE: ${p.unique_selling_proposition}`;
                }
                if (p.professional_title || p.bio) {
                  profileSector = `👤 CHI È ${consultantName}: ${p.professional_title || ''}${p.bio ? ` — ${p.bio}` : ''}`;
                }
                console.log(`📊 [${connectionId}] Consultant profile loaded: services=${!!p.services_offered}, target=${!!p.ideal_client_description}, usp=${!!p.unique_selling_proposition}`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not load consultant profile:`, err);
            }
            
            contentPrompt = resolveTemplateVariables(template.prompt, {
              consultantName: consultantName,
              businessName: consultantBusinessName || '',
              aiName: 'Alessia',
              contactName: extractedContactName || '',
              services: profileServices,
              targetAudience: profileTarget,
              usp: profileUsp,
              sector: profileSector,
            });
            console.log(`📞 [${connectionId}] ${isOutbound ? 'OUTBOUND' : 'INBOUND'} - Using template: ${template.name} (${templateId}) - ${contentPrompt.length} chars - contactName: "${extractedContactName || '(none)'}"`);

          } else {
            // Template not found, fall back to legacy default
            console.warn(`⚠️ [${connectionId}] Template '${templateId}' not found, using legacy default`);
            contentPrompt = interpolatePlaceholders(DEFAULT_NON_CLIENT_PROMPT + NON_CLIENT_PROMPT_SUFFIX);
          }
        }
        
        // Get current Italian time for the prompt
        const italianTime = new Date().toLocaleString('it-IT', { 
          timeZone: 'Europe/Rome',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // 📊 LOG SCENARIO TABLE FOR NON-CLIENT - DEFERRED to avoid blocking critical path
        const nonClientHasPreviousConvs = previousCallContext ? true : false;
        const directionLabel = isOutbound ? 'OUTBOUND' : 'INBOUND';
        const scenarioLabel = isOutbound ? 'OUTBOUND NON-CLIENT (SCENARIO 3)' : 'INBOUND NON-CLIENT (SCENARIO 2)';
        console.log(`📊 [${connectionId}] Scenario: ${scenarioLabel} | Prompt: ${promptSource} | Template: ${templateId} | PrevConvs: ${nonClientHasPreviousConvs}`);
        setImmediate(() => {
          console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
          console.log(`│           📊 SCENARIO DETECTION: NON-CLIENT ${directionLabel.padEnd(8)}              │`);
          console.log(`├─────────────────────────────────────────────────────────────────────┤`);
          console.log(`│ Parametro                    │ Valore                              │`);
          console.log(`├─────────────────────────────────────────────────────────────────────┤`);
          console.log(`│ È cliente registrato?        │ ❌ NO                                │`);
          console.log(`│ Ha istruzione (task/remind)? │ ❌ NO                                │`);
          console.log(`│ Conversazioni precedenti?    │ ${nonClientHasPreviousConvs ? '✅ SÌ' : '❌ NO'}                               │`);
          console.log(`│ Caller ID                    │ ${(phoneCallerId || 'N/A').substring(0, 20).padEnd(20)}                 │`);
          console.log(`│ Scheduled Call ID            │ ${(phoneScheduledCallId || 'N/A').substring(0, 20).padEnd(20)}                 │`);
          console.log(`│ Direction                    │ ${directionLabel.padEnd(20)}                 │`);
          console.log(`│ Prompt Source                │ ${promptSource.padEnd(20)}                 │`);
          console.log(`│ Template ID                  │ ${templateId.padEnd(20)}                 │`);
          console.log(`├─────────────────────────────────────────────────────────────────────┤`);
          console.log(`│ 🎯 SCENARIO                  │ ${scenarioLabel.padEnd(20)}    │`);
          console.log(`└─────────────────────────────────────────────────────────────────────┘`);
        });
        
        let nonClientBrandVoiceSection = '';
        nonClientBrandVoiceSection = await _nonInstructionBrandVoicePromise;
        if (nonClientBrandVoiceSection) {
          _ncLatency.brandVoiceResolvedTime = Date.now();
          _ncLatency.brandVoiceChars = nonClientBrandVoiceSection.length;
          console.log(`🏢 [${connectionId}] Brand Voice loaded for ${isOutbound ? 'OUTBOUND' : 'INBOUND'} non-client (${nonClientBrandVoiceSection.length} chars)`);
          console.log(`⏱️ [NC-LATENCY] brandVoice resolved (non-instruction path): +${_ncLatency.brandVoiceResolvedTime - _ncParallelStart}ms`);
        }
        
        // 🎯 Direction context - clear indication of who called who
        const directionContext = isOutbound 
          ? `📲 DIREZIONE: OUTBOUND - TU stai chiamando questa persona. Puoi dire "ti chiamo perché..." o "ti stavo cercando..."`
          : `📲 DIREZIONE: INBOUND - Questa persona TI STA CHIAMANDO. NON dire MAI "ti stavo chiamando", "ti richiamo", "ti stavo cercando". Rispondi alla loro chiamata!`;
        
        // 📱 Build caller contact data section for system instruction
        let callerContactSection = '';
        if (phoneCallerId) {
          callerContactSection = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 DATI CHIAMANTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Numero telefono: ${phoneCallerId}`;
          
          if (leadContactData.leadId) {
            if (leadContactData.name) {
              callerContactSection += `\n• Nome: ${leadContactData.name}`;
            }
            if (leadContactData.email) {
              callerContactSection += `\n• Email: ${leadContactData.email}`;
            }
            if (leadContactData.category) {
              callerContactSection += `\n• Categoria lead: ${leadContactData.category}`;
            }
            callerContactSection += `\n
⚡ ISTRUZIONE: Hai GIÀ queste informazioni di contatto dal CRM.
Quando si parla di prenotare un appuntamento:
- Proponi i dati che hai: "Ho il tuo numero ${phoneCallerId}${leadContactData.email ? `, e come email risulta ${leadContactData.email}` : ''}. Vanno bene per l'invito?"
- Se il chiamante conferma, usa quei dati
- Se il chiamante vuole dati diversi, accetta la correzione
- NON chiedere telefono o email se li hai già — proponili e chiedi conferma!`;
          } else {
            callerContactSection += `\n
📝 NOTA: Hai il numero di telefono del chiamante. Per la prenotazione:
- Il telefono è già noto (${phoneCallerId}), chiedi solo conferma
- Dovrai chiedere email e nome se non emergono dalla conversazione`;
          }
          callerContactSection += '\n';
        }
        
        if (voiceDeferredPrompt) {
          systemInstruction = `${finalVoiceDirectives}

${directionContext}
${hunterContextBlock ? hunterContextBlock + '\n' : ''}${callerContactSection}
📅 Data e ora attuale: ${italianTime} (fuso orario Italia)`;

          const deferredParts: string[] = [];
          if (nonClientBrandVoiceSection) deferredParts.push(nonClientBrandVoiceSection);
          if (consultantDetailedProfileSection) deferredParts.push(consultantDetailedProfileSection);
          if (contentPrompt) deferredParts.push(contentPrompt);
          _ncLatency.deferredContentChunk = deferredParts.join('\n\n');
          console.log(`🚀 [${connectionId}] DEFERRED PROMPT MODE: systemInstruction=${systemInstruction.length} chars (~${Math.round(systemInstruction.length / 4)} tokens), deferredContent=${_ncLatency.deferredContentChunk.length} chars`);
        } else {
          systemInstruction = `${finalVoiceDirectives}

${directionContext}
${nonClientBrandVoiceSection ? '\n' + nonClientBrandVoiceSection + '\n' : ''}${consultantDetailedProfileSection ? '\n' + consultantDetailedProfileSection + '\n' : ''}${hunterContextBlock ? '\n' + hunterContextBlock + '\n' : ''}${callerContactSection}
📅 Data e ora attuale: ${italianTime} (fuso orario Italia)

${contentPrompt}`;
        }

        if (previousCallContext) {
          _ncLatency.deferredCallHistory = previousCallContext;
          console.log(`📚 [${connectionId}] Call history DEFERRED from system_instruction (${previousCallContext.length} chars) → will be sent after greeting`);
        }

        _ncLatency.promptBuildDoneTime = Date.now();
        _ncLatency.hasInstruction = false;
        _ncLatency.hasCallHistory = !!previousCallContext;
        _ncLatency.callDirection = isOutbound ? 'OUTBOUND' : 'INBOUND';
        _ncLatency.promptSource = promptSource;
        _ncLatency.voiceDirectivesChars = finalVoiceDirectives.length;
        _ncLatency.contentPromptChars = contentPrompt.length;
        _ncLatency.previousCallContextChars = previousCallContext?.length || 0;
        _ncLatency.previousConversationsCount = previousCallContext ? _ncLatency.previousConversationsDbRows : 0;
        console.log(`⏱️ [NC-LATENCY] Prompt build done (non-instruction path): +${_ncLatency.promptBuildDoneTime - _ncParallelStart}ms`);
        console.log(`📏 [NC-CONTEXT] Components: voiceDirectives=${_ncLatency.voiceDirectivesChars} | brandVoice=${_ncLatency.brandVoiceChars} | contentPrompt=${_ncLatency.contentPromptChars} | callHistory=${_ncLatency.previousCallContextChars} | TOTAL systemInstruction=${systemInstruction.length} chars (~${Math.round(systemInstruction.length / 4)} tokens)`);

        userDataContext = ''; // No user data for unknown callers
        console.log(`📞 [${connectionId}] ${isOutbound ? 'OUTBOUND' : 'INBOUND'} non-client prompt built (${systemInstruction.length} chars) - Source: ${promptSource}, Template: ${templateId}${previousCallContext ? ' [CALL HISTORY DEFERRED]' : ''}${nonClientBrandVoiceSection ? ' [WITH BRAND VOICE]' : ''}`);
        
        // 🔍 DEBUG: Full system prompt log placeholder - actual log moved to after booking section append
        } // Close the else block for non-instruction flow
      }
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // CLIENT MODE - Build prompt from user context
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      else {
        console.log(`📊 [${connectionId}] CLIENT MODE - Building user context...`);
        // Pass sessionType to buildUserContext for proper separation
        const buildUserContextStart = Date.now();
        userContext = await buildUserContext(userId!, {
          message: '',
          sessionType: sessionType // 'weekly_consultation' or undefined
        });
        console.log(`⏱️ [DATA LOAD] buildUserContext: ${Date.now() - buildUserContextStart}ms`);
        
        // Import the functions for Live API
        const { 
          buildMinimalSystemInstructionForLive, 
          buildFullSystemInstructionForLive,
          buildUserDataContextForLive,
          buildDynamicContextForLive  // ✅ NEW: For cache optimization
        } = await import('../ai-prompts');
        
        // 🎯 PRIORITY CHECK: If there's a specific call instruction for CLIENT
        if (phoneCallInstruction && isPhoneCall) {
          console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🎯 [${connectionId}] CLIENT CALL WITH INSTRUCTION (PRIORITY MODE)`);
          console.log(`🎯   Type: ${phoneInstructionType || 'generic'}`);
          console.log(`🎯   Instruction: ${phoneCallInstruction}`);
          console.log(`🎯   Client User ID: ${userId}`);
          console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          // Get current Italian time
          const italianTime = new Date().toLocaleString('it-IT', { 
            timeZone: 'Europe/Rome',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Get consultant name for the prompt
          let clientConsultantName = 'il consulente';
          let clientDetailedProfileSection = '';
          if (consultantId) {
            try {
              const consultantInfoStart = Date.now();
              const consultant = await storage.getUser(consultantId);
              console.log(`⏱️ [DATA LOAD] client consultantInfo query: ${Date.now() - consultantInfoStart}ms`);
              if (consultant) {
                const fullName = [consultant.firstName, consultant.lastName].filter(Boolean).join(' ').trim();
                clientConsultantName = fullName || consultant.email?.split('@')[0] || 'il consulente';
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not fetch consultant info:`, err);
            }
            try {
              const dpResult = await db.select().from(consultantDetailedProfiles).where(eq(consultantDetailedProfiles.consultantId, consultantId));
              clientDetailedProfileSection = buildDetailedProfileSection(dpResult[0]);
              if (clientDetailedProfileSection) {
                console.log(`📋 [${connectionId}] Client path: detailed profile loaded (${clientDetailedProfileSection.length} chars)`);
              }
            } catch (dpErr: any) {
              console.warn(`⚠️ [${connectionId}] Failed to load detailed profile for client path: ${dpErr.message}`);
            }
          }
          
          // 🎙️ Fetch voice directives from database for this consultant
          let clientVoiceDirectives = '';
          if (consultantId) {
            try {
              const voiceDirectivesStart = Date.now();
              const settingsResult = await db
                .select({
                  voiceDirectives: consultantAvailabilitySettings.voiceDirectives,
                })
                .from(consultantAvailabilitySettings)
                .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
              console.log(`⏱️ [DATA LOAD] client voiceDirectives query: ${Date.now() - voiceDirectivesStart}ms`);
              
              if (settingsResult.length > 0 && settingsResult[0].voiceDirectives) {
                clientVoiceDirectives = settingsResult[0].voiceDirectives;
                console.log(`🎙️ [${connectionId}] Using consultant voice directives for client call (${clientVoiceDirectives.length} chars)`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not fetch voice directives:`, err);
            }
          }
          
          // Use consultant's voice directives or fallback to default
          const clientVoiceDirectivesSection = clientVoiceDirectives || `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ TONO E STILE - SEMPRE ENERGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ Mantieni SEMPRE un tono allegro, energico e dinamico!
🎯 Sii diretta e vai al punto - niente giri di parole
💬 DAI DEL TU sempre, mai del Lei
😊 Usa un linguaggio colloquiale e amichevole
🚫 NO suoni tipo "Mmm", "Uhm", "Ehm", "Ah"`;
          
          // Get client name from context
          const clientName = userContext.user?.firstName || userContext.user?.email?.split('@')[0] || 'il cliente';
          
          // 📞 LOAD PREVIOUS CONVERSATIONS FOR CONTEXT (max 8000 chars ≈ 2k tokens)
          const CLIENT_MAX_HISTORY_CHARS = 8000;
          let clientInstructionCallHistory = '';
          let clientInstructionHasPreviousConversations = false;
          if (phoneCallerId) {
            try {
              const clientPrevConvsStart = Date.now();
              const previousConversations = await db.execute(sql`
                SELECT 
                  ac.id,
                  ac.title,
                  ac.created_at,
                  (
                    SELECT json_agg(msg_data ORDER BY msg_data->>'created_at' ASC)
                    FROM (
                      SELECT json_build_object(
                        'role', am.role,
                        'content', am.content,
                        'created_at', am.created_at
                      ) as msg_data
                      FROM ai_messages am
                      WHERE am.conversation_id = ac.id
                      ORDER BY am.created_at ASC
                    ) sub
                  ) as messages
                FROM ai_conversations ac
                WHERE (ac.caller_phone = ${phoneCallerId}
                  OR ac.caller_phone = ${phoneCallerId.replace(/^\+/, '')}
                  OR ('+' || ac.caller_phone) = ${phoneCallerId})
                  AND ac.consultant_id = ${consultantId}
                ORDER BY ac.created_at DESC
                LIMIT 100
              `);
              
              console.log(`⏱️ [DATA LOAD] client previousConversations query (instruction path): ${Date.now() - clientPrevConvsStart}ms (${previousConversations.rows.length} rows)`);
              if (previousConversations.rows.length > 0) {
                clientInstructionHasPreviousConversations = true;
                let historyContent = '';
                let includedConvCount = 0;
                
                for (const conv of previousConversations.rows as any[]) {
                  let convText = '';
                  const callDate = new Date(conv.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  convText += `📅 Chiamata del ${callDate}\n`;
                  convText += `Titolo: ${conv.title || 'Conversazione vocale'}\n\n`;
                  
                  if (conv.messages && Array.isArray(conv.messages)) {
                    for (const msg of conv.messages) {
                      const roleLabel = msg.role === 'user' ? `👤 ${clientName}` : '🤖 Tu';
                      const msgContent = msg.role === 'assistant' ? stripAiThinking(msg.content) : msg.content;
                      convText += `${roleLabel}: ${msgContent}\n`;
                    }
                  }
                  convText += '\n---\n\n';
                  
                  if (historyContent.length + convText.length > CLIENT_MAX_HISTORY_CHARS) {
                    break;
                  }
                  
                  historyContent += convText;
                  includedConvCount++;
                }
                
                if (historyContent.length > 0) {
                  console.log(`📱 [${connectionId}] Included ${includedConvCount} conversations (${historyContent.length} chars) for client instruction call`);
                  
                  clientInstructionCallHistory = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI (CONTESTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai già parlato con ${clientName}! Ecco le conversazioni precedenti:

${historyContent}
💡 Usa queste info per far sentire ${clientName} riconosciuto!
`;
                }
              } else {
                clientInstructionHasPreviousConversations = false;
                console.log(`📱 [${connectionId}] No previous conversations found for client ${phoneCallerId}`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not load previous conversations for client instruction call:`, err);
            }
          }
          
          // Build instruction type label
          const instructionTypeLabel = phoneInstructionType === 'task' ? '📋 TASK' : 
                                        phoneInstructionType === 'reminder' ? '⏰ PROMEMORIA' : '🎯 ISTRUZIONE';
          
          // 📊 LOG SCENARIO TABLE FOR CLIENT WITH INSTRUCTION (SCENARIO 3/4) - DEFERRED
          const _deferredClientInstrHasPrevConvs = clientInstructionHasPreviousConversations;
          const _deferredClientName = clientName;
          const _deferredClientUserId = userId;
          const _deferredClientInstrType = phoneInstructionType;
          setImmediate(() => {
            console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
            console.log(`│           📊 SCENARIO DETECTION: CLIENT + INSTRUCTION               │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ Parametro                    │ Valore                              │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ È cliente registrato?        │ ✅ SÌ                                │`);
            console.log(`│ Ha istruzione (task/remind)? │ ✅ SÌ (${(_deferredClientInstrType || 'generic').padEnd(10)})              │`);
            console.log(`│ Conversazioni precedenti?    │ ${_deferredClientInstrHasPrevConvs ? '✅ SÌ' : '❌ NO'}                               │`);
            console.log(`│ Client User ID               │ ${(_deferredClientUserId?.toString() || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`│ Nome Cliente                 │ ${(_deferredClientName || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 🎯 SCENARIO                  │ OUTBOUND CLIENT + TASK/REMINDER     │`);
            console.log(`│                              │ (SCENARIO 3/4)                      │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 💬 COMPORTAMENTO ATTESO:                                            │`);
            if (_deferredClientInstrHasPrevConvs) {
              console.log(`│   → Saluto caloroso ("Ciao ${_deferredClientName.substring(0, 15)}! Come stai?")`.padEnd(70) + `│`);
              console.log(`│   → NON si presenta (sa già chi è!)                                 │`);
              console.log(`│   → Va dritto all'istruzione (task/reminder)                        │`);
            } else {
              console.log(`│   → Si presenta brevemente ("Sono Alessia di...")                   │`);
              console.log(`│   → Poi va dritto all'istruzione (task/reminder)                    │`);
            }
            console.log(`│ 📋 PROMPT USED               │ Instruction Priority + Client Prompt│`);
            console.log(`└─────────────────────────────────────────────────────────────────────┘\n`);
          });
          
          // Build the client's normal system prompt
          const clientSystemPrompt = buildFullSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null,
            userContext
          );
          
          // Build dynamic greeting section based on previous conversations with client
          // If already talked → don't re-introduce yourself, go straight to point
          // If first time → brief intro, then go to point
          const clientInstructionGreetingSection = clientInstructionHasPreviousConversations 
            ? `⚠️ IMPORTANTE: Hai GIÀ parlato con ${clientName}! NON ripresentarti!

1️⃣ SALUTO INIZIALE (caloroso, lo/la conosci già!):
   "Ciao ${clientName}! Come stai?"
   "Ehi ${clientName}! Tutto bene?"
   
   🚫 NON DIRE: "Sono Alessia" o "Sono l'assistente di..." (sa già chi sei!)
   
2️⃣ CHIACCHIERATA BREVE (dopo che rispondono):
   Rispondi al loro "come stai" - "Fantastico! Anch'io alla grande!"
   
3️⃣ INTRODUCI L'ISTRUZIONE IN MODO NATURALE:
   "Senti, ti stavo chiamando perché..." 
   "Allora, ti volevo avvisare che..."
   "Guarda, il motivo della chiamata è..."
   
4️⃣ RECITA L'ISTRUZIONE (non leggerla!):
   Riformula l'istruzione con parole tue, come farebbe un vero collega
   
5️⃣ CONFERMA E CHIUDI:
   Assicurati che abbia capito, poi chiedi se c'è altro

💡 ESEMPI DI APERTURA NATURALE (lo/la conosci già!):
- "Ciao ${clientName}! Come va? Ti chiamo veloce..."
- "Ehi ${clientName}! Tutto bene? Senti, ti volevo dire una cosa..."
- "${clientName}! Che piacere sentirti! Come stai?"`
            : `📌 NOTA: Prima chiamata vocale con ${clientName} (è comunque un cliente registrato)

1️⃣ SALUTO INIZIALE + BREVE PRESENTAZIONE:
   "Ciao ${clientName}! Sono Alessia, l'assistente di ${clientConsultantName}. Come stai?"
   "Ehi ${clientName}! Sono Alessia, tutto bene?"
   
2️⃣ CHIACCHIERATA BREVE (dopo che rispondono):
   Rispondi al loro "come stai" - "Fantastico! Anch'io alla grande!"
   
3️⃣ INTRODUCI L'ISTRUZIONE IN MODO NATURALE:
   "Senti, ti stavo chiamando perché..." 
   "Allora, ti volevo avvisare che..."
   "Guarda, il motivo della chiamata è..."
   
4️⃣ RECITA L'ISTRUZIONE (non leggerla!):
   Riformula l'istruzione con parole tue, come farebbe un vero collega
   
5️⃣ CONFERMA E CHIUDI:
   Assicurati che abbia capito, poi chiedi se c'è altro

💡 ESEMPI DI APERTURA NATURALE (prima chiamata):
- "Ciao ${clientName}! Sono Alessia, come va? Ti chiamo veloce..."
- "Ehi ${clientName}! Sono Alessia di ${clientConsultantName}, tutto bene? Senti, ti volevo dire una cosa..."`;
          
          // Prepend: VOICE DIRECTIVES + instruction priority to client's system prompt
          const instructionPrefix = `${clientVoiceDirectivesSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 CHI SEI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Sei Alessia, l'assistente AI di ${clientConsultantName}.
Stai chiamando ${clientName}, un CLIENTE REGISTRATO che già conosci!
${clientDetailedProfileSection ? '\n' + clientDetailedProfileSection : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 IL TUO COMPITO PER QUESTA CHIAMATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${instructionTypeLabel}:
${phoneCallInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 COME COMPORTARTI - SII UMANA, NON ROBOTICA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ NON leggere l'istruzione come un robot! RECITALA in modo naturale.

📞 FLUSSO DELLA CHIAMATA:

${clientInstructionGreetingSection}

🚫 NON FARE:
- NON iniziare subito con l'istruzione senza salutare
- NON leggere l'istruzione parola per parola come un robot
- NON chiedere "Come posso aiutarti?" - sei TU che chiami!
- NON essere troppo formale - è un cliente che conosci!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 CONTESTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data e ora: ${italianTime} (Italia)
Tipo chiamata: OUTBOUND a cliente registrato ${clientInstructionHasPreviousConversations ? '(già parlato prima)' : '(prima chiamata vocale)'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DOPO CHE L'ISTRUZIONE È COMPLETATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Una volta che ${clientName} ha capito e confermato:
• Chiedi "C'è qualcos'altro di cui hai bisogno?"
• Se no, saluta "Perfetto! Ci sentiamo, ciao!"
• Usa il tuo system prompt normale (sotto) se serve aiuto su altro
${clientInstructionCallHistory}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 IL TUO SYSTEM PROMPT NORMALE (da usare DOPO l'istruzione)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
          
          systemInstruction = instructionPrefix + clientSystemPrompt;
          userDataContext = ''; // Already included in clientSystemPrompt
          
          console.log(`🎯 [${connectionId}] Client instruction prompt built (${systemInstruction.length} chars)${clientInstructionCallHistory ? ' [WITH CALL HISTORY]' : ''}`);
          
          // 🔥 PRINT FULL PROMPT FOR DEBUGGING - DEFERRED to avoid blocking critical path
          const _deferredClientInstrPrompt = systemInstruction;
          setImmediate(() => {
            console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🎯 FULL CLIENT INSTRUCTION PROMPT (first 2000 chars):`);
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(_deferredClientInstrPrompt.substring(0, 2000) + (_deferredClientInstrPrompt.length > 2000 ? '\n... [truncated]' : ''));
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          });
        } else if (isPhoneCall && !phoneCallInstruction) {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 📞 SCENARIO 1: CHIAMATA IN DA CLIENTE NOTO (senza instruction)
          // Usa il system prompt di live-consultation + voice directives
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          
          // Will be determined later
          let inboundClientHasPreviousConvs = false;
          
          // Get current Italian time
          const italianTime = new Date().toLocaleString('it-IT', { 
            timeZone: 'Europe/Rome',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Get consultant info for the prompt
          let inboundConsultantName = 'il consulente';
          let inboundDetailedProfileSection = '';
          if (consultantId) {
            try {
              const inboundConsultantInfoStart = Date.now();
              const consultant = await storage.getUser(consultantId);
              console.log(`⏱️ [DATA LOAD] inbound consultantInfo query: ${Date.now() - inboundConsultantInfoStart}ms`);
              if (consultant) {
                const fullName = [consultant.firstName, consultant.lastName].filter(Boolean).join(' ').trim();
                inboundConsultantName = fullName || consultant.email?.split('@')[0] || 'il consulente';
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not fetch consultant info:`, err);
            }
            try {
              const dpResult = await db.select().from(consultantDetailedProfiles).where(eq(consultantDetailedProfiles.consultantId, consultantId));
              inboundDetailedProfileSection = buildDetailedProfileSection(dpResult[0]);
              if (inboundDetailedProfileSection) {
                console.log(`📋 [${connectionId}] Inbound path: detailed profile loaded (${inboundDetailedProfileSection.length} chars)`);
              }
            } catch (dpErr: any) {
              console.warn(`⚠️ [${connectionId}] Failed to load detailed profile for inbound path: ${dpErr.message}`);
            }
          }
          
          // 🎙️ Fetch voice directives from database for this consultant
          let inboundVoiceDirectives = '';
          if (consultantId) {
            try {
              const inboundVoiceDirectivesStart = Date.now();
              const settingsResult = await db
                .select({
                  voiceDirectives: consultantAvailabilitySettings.voiceDirectives,
                })
                .from(consultantAvailabilitySettings)
                .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
              console.log(`⏱️ [DATA LOAD] inbound voiceDirectives query: ${Date.now() - inboundVoiceDirectivesStart}ms`);
              
              if (settingsResult.length > 0 && settingsResult[0].voiceDirectives) {
                inboundVoiceDirectives = settingsResult[0].voiceDirectives;
                console.log(`🎙️ [${connectionId}] Using consultant voice directives for inbound client call (${inboundVoiceDirectives.length} chars)`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not fetch voice directives:`, err);
            }
          }
          
          // Use consultant's voice directives or fallback to default
          const inboundVoiceDirectivesSection = inboundVoiceDirectives || `🎙️ MODALITÀ: CHIAMATA VOCALE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗣️ TONO E STILE - SEMPRE ENERGICO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ Mantieni SEMPRE un tono allegro, energico e dinamico!
🎯 Sii diretta e vai al punto - niente giri di parole
💬 DAI DEL TU sempre, mai del Lei
😊 Usa un linguaggio colloquiale e amichevole
🚫 NO suoni tipo "Mmm", "Uhm", "Ehm", "Ah"`;
          
          // Get client name from context
          const inboundClientName = userContext.user?.firstName || userContext.user?.email?.split('@')[0] || 'il cliente';
          
          // 📞 LOAD PREVIOUS CONVERSATIONS FOR CONTEXT (max 8000 chars ≈ 2k tokens)
          const INBOUND_MAX_HISTORY_CHARS = 8000;
          let inboundCallHistory = '';
          let hasPreviousConversations = false;
          if (phoneCallerId) {
            try {
              const inboundPrevConvsStart = Date.now();
              const previousConversations = await db.execute(sql`
                SELECT 
                  ac.id,
                  ac.title,
                  ac.created_at,
                  (
                    SELECT json_agg(msg_data ORDER BY msg_data->>'created_at' ASC)
                    FROM (
                      SELECT json_build_object(
                        'role', am.role,
                        'content', am.content,
                        'created_at', am.created_at
                      ) as msg_data
                      FROM ai_messages am
                      WHERE am.conversation_id = ac.id
                      ORDER BY am.created_at ASC
                    ) sub
                  ) as messages
                FROM ai_conversations ac
                WHERE (ac.caller_phone = ${phoneCallerId}
                  OR ac.caller_phone = ${phoneCallerId.replace(/^\+/, '')}
                  OR ('+' || ac.caller_phone) = ${phoneCallerId})
                  AND ac.consultant_id = ${consultantId}
                ORDER BY ac.created_at DESC
                LIMIT 100
              `);
              
              console.log(`⏱️ [DATA LOAD] inbound previousConversations query: ${Date.now() - inboundPrevConvsStart}ms (${previousConversations.rows.length} rows)`);
              if (previousConversations.rows.length > 0) {
                hasPreviousConversations = true;
                let historyContent = '';
                let includedConvCount = 0;
                
                for (const conv of previousConversations.rows as any[]) {
                  let convText = '';
                  const callDate = new Date(conv.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  convText += `📅 Chiamata del ${callDate}\n`;
                  convText += `Titolo: ${conv.title || 'Conversazione vocale'}\n\n`;
                  
                  if (conv.messages && Array.isArray(conv.messages)) {
                    for (const msg of conv.messages) {
                      const roleLabel = msg.role === 'user' ? `👤 ${inboundClientName}` : '🤖 Tu';
                      const msgContent = msg.role === 'assistant' ? stripAiThinking(msg.content) : msg.content;
                      convText += `${roleLabel}: ${msgContent}\n`;
                    }
                  }
                  convText += '\n---\n\n';
                  
                  if (historyContent.length + convText.length > INBOUND_MAX_HISTORY_CHARS) {
                    break;
                  }
                  
                  historyContent += convText;
                  includedConvCount++;
                }
                
                if (historyContent.length > 0) {
                  console.log(`📱 [${connectionId}] Included ${includedConvCount} conversations (${historyContent.length} chars) for inbound client call`);
                  
                  inboundCallHistory = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 STORICO CHIAMATE PRECEDENTI (CONTESTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hai già parlato con ${inboundClientName}! Ecco le conversazioni precedenti:

${historyContent}
💡 Usa queste info per far sentire ${inboundClientName} riconosciuto!
`;
                }
                inboundClientHasPreviousConvs = true;
              } else {
                inboundClientHasPreviousConvs = false;
                console.log(`📱 [${connectionId}] No previous conversations found for inbound client ${phoneCallerId}`);
              }
            } catch (err) {
              console.warn(`⚠️ [${connectionId}] Could not load previous conversations for inbound client call:`, err);
            }
          }
          
          // 🎯 FIX: Determine if this is an OUTBOUND call to a client
          const isClientOutbound = !!phoneScheduledCallId;
          const clientDirectionLabel = isClientOutbound ? 'OUTBOUND' : 'INBOUND';
          const clientScenarioLabel = isClientOutbound ? 'OUTBOUND CLIENT (SCENARIO 4)' : 'INBOUND CLIENT (SCENARIO 1)';
          
          // 📊 LOG SCENARIO TABLE FOR CLIENT (INBOUND or OUTBOUND) - DEFERRED
          const _deferredHasPrevConvs = hasPreviousConversations;
          const _deferredInboundClientName = inboundClientName;
          const _deferredClientDirLabel = clientDirectionLabel;
          const _deferredClientScenLabel = clientScenarioLabel;
          const _deferredIsClientOutbound = isClientOutbound;
          const _deferredClientUserId2 = userId;
          setImmediate(() => {
            console.log(`\n┌─────────────────────────────────────────────────────────────────────┐`);
            console.log(`│           📊 SCENARIO DETECTION: CLIENT ${_deferredClientDirLabel.padEnd(8)}                   │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ Parametro                    │ Valore                              │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ È cliente registrato?        │ ✅ SÌ                                │`);
            console.log(`│ Ha istruzione (task/remind)? │ ❌ NO                                │`);
            console.log(`│ Conversazioni precedenti?    │ ${_deferredHasPrevConvs ? '✅ SÌ' : '❌ NO'}                               │`);
            console.log(`│ Client User ID               │ ${(_deferredClientUserId2?.toString() || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`│ Nome Cliente                 │ ${(_deferredInboundClientName || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`│ Scheduled Call ID            │ ${(phoneScheduledCallId || 'N/A').substring(0, 20).padEnd(20)}                 │`);
            console.log(`│ Direction                    │ ${_deferredClientDirLabel.padEnd(20)}                 │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 🎯 SCENARIO                  │ ${_deferredClientScenLabel.padEnd(20)}   │`);
            console.log(`├─────────────────────────────────────────────────────────────────────┤`);
            console.log(`│ 💬 COMPORTAMENTO ATTESO:                                            │`);
            if (_deferredIsClientOutbound) {
              console.log(`│   → Saluta il cliente (TU stai chiamando LUI)                        │`);
              console.log(`│   → Usa contesto cliente per personalizzare                          │`);
              console.log(`│   → Segui obiettivo della chiamata schedulata                        │`);
            } else if (_deferredHasPrevConvs) {
              console.log(`│   → Saluto caloroso ("Ciao ${_deferredInboundClientName.substring(0, 15)}! Come stai?")`.padEnd(70) + `│`);
              console.log(`│   → NON si presenta (sa già chi è!)                                 │`);
              console.log(`│   → Chiede come può aiutare                                          │`);
            } else {
              console.log(`│   → Si presenta brevemente ("Sono Alessia di...")                   │`);
              console.log(`│   → Chiede come può aiutare                                          │`);
            }
            console.log(`│ 📋 PROMPT USED               │ Live-Consultation + Voice Directives│`);
            console.log(`└─────────────────────────────────────────────────────────────────────┘\n`);
          });
          
          // Build the client's FULL system prompt using live-consultation mode
          const clientLiveSystemPrompt = buildFullSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null,
            userContext
          );
          
          // Determine greeting based on previous conversations
          const greetingSection = hasPreviousConversations 
            ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 SALUTO INIZIALE (LO/LA CONOSCI!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANTE: Hai già parlato con ${inboundClientName}! NON ripresentarti!

✅ SALUTI CORRETTI:
- "Ciao ${inboundClientName}! Come stai?"
- "Ehi ${inboundClientName}! Tutto bene?"
- "${inboundClientName}! Che bello risentirti! Come va?"

🚫 NON DIRE MAI:
- "Ciao sono Alessia..." (sa già chi sei!)
- "Sono l'assistente di..." (sa già chi sei!)
- Qualsiasi presentazione formale

`
            : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 SALUTO INIZIALE (PRIMA CHIAMATA VOCALE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questa è la prima chiamata vocale con ${inboundClientName}.
Presentati brevemente e poi ascolta cosa serve.

✅ ESEMPIO: "Ciao ${inboundClientName}! Sono Alessia, ti assisto per conto di ${inboundConsultantName}. Dimmi pure, come posso aiutarti?"

`;
          
          // Combine: Voice Directives + Greeting + Call History + Full Live-Consultation Prompt
          systemInstruction = `${inboundVoiceDirectivesSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 CONTESTO CHIAMATA IN ENTRATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data e ora: ${italianTime} (Italia)
Tipo chiamata: INBOUND (${inboundClientName} ti sta chiamando)
Cliente: ${inboundClientName} (CLIENTE REGISTRATO ✅)
Consulente: ${inboundConsultantName}
${inboundDetailedProfileSection ? '\n' + inboundDetailedProfileSection : ''}
${greetingSection}${inboundCallHistory}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 IL TUO SYSTEM PROMPT COMPLETO (Live-Consultation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${clientLiveSystemPrompt}`;
          
          userDataContext = ''; // Already included in clientLiveSystemPrompt
          
          console.log(`📞 [${connectionId}] Inbound client call prompt built (${systemInstruction.length} chars)${inboundCallHistory ? ' [WITH CALL HISTORY]' : ''}`);
          
          // 🔥 PRINT FULL PROMPT FOR DEBUGGING - DEFERRED to avoid blocking critical path
          const _deferredScenario1Prompt = systemInstruction;
          setImmediate(() => {
            console.log(`\n📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📞 SCENARIO 1 PROMPT (first 2000 chars):`);
            console.log(`📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(_deferredScenario1Prompt.substring(0, 2000) + (_deferredScenario1Prompt.length > 2000 ? '\n... [truncated]' : ''));
            console.log(`📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          });
        } else if (customPrompt) {
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
          // Early backend detection for context optimization (before credentials are awaited)
          const earlyProvider = (process.env.LIVE_API_PROVIDER || 'auto').toLowerCase().trim();
          const earlyBackend: 'google_ai_studio' | 'vertex_ai' = earlyProvider === 'vertex_ai' ? 'vertex_ai' : 'google_ai_studio';
          console.log(`🎯 [${connectionId}] Early backend detection for context optimization: ${earlyBackend}`);
          
          systemInstruction = buildMinimalSystemInstructionForLive(
            mode,
            mode === 'consulente' ? consultantType : null
          );
          userDataContext = buildDynamicContextForLive(userContext, earlyBackend);
          
          if (earlyBackend === 'google_ai_studio') {
            console.log(`🔵 [${connectionId}] Google AI Studio OPTIMIZED: consulenze first + compressed exercises (${userDataContext?.length || 0} chars)`);
          } else {
            console.log(`🟢 [${connectionId}] Vertex AI FULL context: all data included (${userDataContext?.length || 0} chars)`);
          }
          console.log(`⚡ [${connectionId}] Using OPTIMIZED MODE (static cached prompt + dynamic context injection)`);
        }

        // Aggiungi prompt prefix per consulenze settimanali
        if (sessionType === 'weekly_consultation' && !customPrompt && !phoneCallInstruction) {
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

        // ⚡ O5: Await TASKS + SLOTS before building system prompt (slots already running since auth)
        if (isPhoneCall && consultantId) {
          const _tasksStart = Date.now();
          const preloadedTaskRows = await (_earlyStartedTasksPromise || Promise.resolve({ rows: [] as any[] }));
          console.log(`⏱️ [O5] Tasks await resolved: ${Date.now() - _tasksStart}ms (already running since auth)`);

          let preloadedSlots: any[] = [];
          if (_earlyStartedSlotsPromise) {
            const _slotsStart = Date.now();
            try {
              const slotsResult = await _earlyStartedSlotsPromise;
              if (slotsResult?.success && slotsResult?.result?.slots) {
                preloadedSlots = slotsResult.result.slots.map((s: any) => ({
                  date: s.date,
                  dayOfWeek: s.dayOfWeek,
                  time: s.time,
                  dateFormatted: s.dateFormatted,
                  duration: s.duration || 60,
                }));
              }
              console.log(`⏱️ [O5] Slots await resolved: ${Date.now() - _slotsStart}ms → ${preloadedSlots.length} slots loaded`);
            } catch (err: any) {
              console.warn(`⚠️ [${connectionId}] [O5] Slots await failed: ${err.message}`);
            }
          }

          bookingSupervisor = new VoiceBookingSupervisor({
            consultantId,
            clientId: userId || null,
            voiceCallId: voiceCallId || '',
            outboundTargetPhone: phoneCallerId || null,
            availableSlots: preloadedSlots,
            prePopulatedData: phoneLeadContactData ? {
              phone: phoneLeadContactData.phone,
              email: phoneLeadContactData.email,
              name: phoneLeadContactData.name,
            } : undefined,
          });

          const bookingPromptSection = bookingSupervisor.getBookingPromptSection();
          const bookingConfirmationRule = `

🚨🚨 REGOLA SUPREMA PRENOTAZIONE — DA RISPETTARE SEMPRE 🚨🚨
Prima di procedere con qualsiasi prenotazione appuntamento, DEVI OBBLIGATORIAMENTE:
1. Ripetere al chiamante TUTTI i dati raccolti: data, ora, numero di telefono, email
2. Chiedere conferma esplicita: "È tutto corretto?"
3. Attendere che il chiamante dica "sì" / "confermo" / "esatto"
Se il chiamante NON conferma esplicitamente, NON procedere. Chiedi di nuovo.
Questa regola vale SEMPRE, senza eccezioni, per OGNI prenotazione.`;
          systemInstruction = systemInstruction + '\n\n' + bookingPromptSection + bookingConfirmationRule;
          console.log(`📋 [${connectionId}] Booking prompt section appended WITH ${preloadedSlots.length} slots (${bookingPromptSection.length} chars)`);
          setImmediate(() => {
            console.log(`📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📞 [${connectionId}] FULL NON-CLIENT SYSTEM PROMPT (WITH SLOTS):`);
            console.log(`📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(systemInstruction);
            console.log(`📞 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          });

          taskSupervisor = new VoiceTaskSupervisor({
            consultantId,
            voiceCallId: voiceCallId || '',
            contactPhone: phoneCallerId || '',
            contactName: phoneLeadContactData?.name || null,
            sourceTaskId: phoneSourceTaskId || null,
          });

          const taskPromptSection = await taskSupervisor.getTaskPromptSection(
            (preloadedTaskRows as any)?.rows || []
          );
          systemInstruction = systemInstruction + '\n\n' + taskPromptSection;
          console.log(`📝 [${connectionId}] Task prompt section appended (${taskPromptSection.length} chars)`);
        }

      // Log the system prompt - DEFERRED to avoid blocking critical path
      const _deferredSysInstr = systemInstruction;
      const _deferredCustomPrompt = customPrompt;
      const _deferredUseFullPrompt = useFullPrompt;
      const _deferredMode = mode;
      setImmediate(() => {
        if (_deferredCustomPrompt) {
          console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`┃ 🤖 CUSTOM SYSTEM PROMPT (LIVE MODE) - ${_deferredCustomPrompt.length} chars`);
          console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(_deferredCustomPrompt.substring(0, 1000) + (_deferredCustomPrompt.length > 1000 ? '...' : ''));
          console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        } else {
          console.log(`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`┃ 🤖 ${_deferredUseFullPrompt ? 'FULL' : 'MINIMAL'} SYSTEM PROMPT (LIVE MODE) - ${_deferredSysInstr.length} chars`);
          console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(_deferredSysInstr);
          console.log(`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }
      });
      
      // ⏱️ CRITICAL: Measure data load time BEFORE token analysis logging (which is deferred)
      const dataLoadDoneTime = Date.now();
      const _gapAfterPromptBuild = _ncLatency.promptBuildDoneTime > 0 
        ? dataLoadDoneTime - _ncLatency.promptBuildDoneTime 
        : -1;
      console.log(`⏱️ [LATENCY-E2E] Data loading + prompt build completed: +${dataLoadDoneTime - authDoneTime}ms from auth, total: +${dataLoadDoneTime - wsArrivalTime}ms from WS arrival${_gapAfterPromptBuild >= 0 ? ` (gap after promptBuild: ${_gapAfterPromptBuild}ms)` : ''}`);

      // Calculate detailed token breakdown - DEFERRED to avoid blocking critical path
      const estimateTokens = (text: string) => Math.ceil(text.length / 4);
      const systemInstructionTokens = estimateTokens(systemInstruction);
      const userDataTokens = userDataContext ? estimateTokens(userDataContext) : 0;
      const totalTokens = systemInstructionTokens + userDataTokens;
      
      const _deferredUserContext = userContext;
      const _deferredUserDataContext = userDataContext;
      const _deferredUseFullPrompt2 = useFullPrompt;
      setImmediate(() => {
        console.log(`\n${'═'.repeat(70)}`);
        console.log(`📊 [${connectionId}] TOKEN BREAKDOWN - LIVE MODE`);
        console.log(`${'═'.repeat(70)}`);
        console.log(`🎯 System Instruction: ${systemInstructionTokens.toLocaleString()} tokens`);
        if (_deferredUserDataContext) {
          console.log(`📦 ${_deferredUseFullPrompt2 ? 'Full Prompt' : 'User Data'} Context (formatted & chunked): ${userDataTokens.toLocaleString()} tokens`);
        }
        
        if (mode !== 'sales_agent' && _deferredUserContext) {
          const financeTokens = _deferredUserContext.financeData ? estimateTokens(JSON.stringify(_deferredUserContext.financeData)) : 0;
          const exercisesTokens = estimateTokens(JSON.stringify(_deferredUserContext.exercises));
          const libraryTokens = estimateTokens(JSON.stringify(_deferredUserContext.library.documents));
          const universityTokens = estimateTokens(JSON.stringify(_deferredUserContext.university));
          const consultationsTokens = estimateTokens(JSON.stringify({
            upcoming: _deferredUserContext.consultations.upcoming,
            recent: _deferredUserContext.consultations.recent,
            tasks: _deferredUserContext.consultationTasks
          }));
          const goalsTokens = estimateTokens(JSON.stringify({
            goals: _deferredUserContext.goals,
            dailyTasks: _deferredUserContext.daily?.tasks || [],
            reflection: _deferredUserContext.daily?.todayReflection || null
          }));
          const momentumTokens = estimateTokens(JSON.stringify({
            momentum: _deferredUserContext.momentum,
            calendar: _deferredUserContext.calendar
          }));
          
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
      });

      // 3. Await pre-connected Gemini WS (O3: was connecting in parallel with data loading)
      const preConnectRaw = await geminiPreConnectPromise;
      
      // Re-throw config/credential errors (forced-provider missing creds, no creds at all)
      if (preConnectRaw && 'error' in preConnectRaw) {
        throw preConnectRaw.error;
      }
      const preConnectResult = preConnectRaw as { ws: WebSocket; backend: 'google_ai_studio' | 'vertex_ai'; modelId: string; gConfig: any; vConfig: any; preConnectElapsed: number } | null;
      
      let liveApiBackend: 'google_ai_studio' | 'vertex_ai';
      let liveModelId: string;
      let googleStudioConfig: any;
      let vertexConfig: any;
      
      if (preConnectResult) {
        geminiSession = preConnectResult.ws;
        liveApiBackend = preConnectResult.backend;
        liveModelId = preConnectResult.modelId;
        googleStudioConfig = preConnectResult.gConfig;
        vertexConfig = preConnectResult.vConfig;
        console.log(`🚀 [${connectionId}] O3: Using pre-connected Gemini WS (saved ~${preConnectResult.preConnectElapsed}ms of sequential TLS)`);
        console.log(`   Backend: ${liveApiBackend === 'google_ai_studio' ? '🔵 Google AI Studio' : '🟢 Vertex AI'}`);
        console.log(`   Model: ${liveModelId}`);
      } else {
        console.log(`⚠️ [${connectionId}] O3: Pre-connect failed, falling back to sequential connection...`);
        googleStudioConfig = await googleStudioConfigPromise;
        vertexConfig = await vertexConfigPromise;
        
        const liveApiProviderEnv = (process.env.LIVE_API_PROVIDER || 'auto').toLowerCase().trim();
        let wsUrl: string;
        
        if (liveApiProviderEnv === 'ai_studio' && googleStudioConfig) {
          liveApiBackend = 'google_ai_studio';
          liveModelId = googleStudioConfig.modelId;
          wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${googleStudioConfig.apiKey}`;
        } else if (liveApiProviderEnv === 'vertex_ai' && vertexConfig) {
          liveApiBackend = 'vertex_ai';
          liveModelId = vertexConfig.modelId;
          wsUrl = `wss://${vertexConfig.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
        } else if (googleStudioConfig) {
          liveApiBackend = 'google_ai_studio';
          liveModelId = googleStudioConfig.modelId;
          wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${googleStudioConfig.apiKey}`;
        } else if (vertexConfig) {
          liveApiBackend = 'vertex_ai';
          liveModelId = vertexConfig.modelId;
          wsUrl = `wss://${vertexConfig.location}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;
        } else {
          throw new Error('Failed to get Live API credentials');
        }
        
        if (liveApiBackend === 'google_ai_studio') {
          geminiSession = new WebSocket(wsUrl);
        } else {
          geminiSession = new WebSocket(wsUrl, {
            headers: {
              'Authorization': `Bearer ${vertexConfig!.accessToken}`,
              'Content-Type': 'application/json',
            }
          });
        }
        console.log(`🔌 [${connectionId}] Sequential WS connection started (fallback)`);
      }
      
      // 🔌 Track this connection in global tracker (P0.1 - con lastActivity per anti-zombie)
      const now = new Date();
      activeGeminiConnections.set(connectionId, {
        connectionId,
        mode,
        startedAt: now,
        lastActivity: now,
        status: 'connecting',
        retryCount: 0,
        websocket: geminiSession,
        callerWebsocket: clientWs,
        consultantId,
        callId: conversationId,
        clientId: agentBusinessContext?.clientId
      });
      console.log(`🔌 [${connectionId}] Added to connection tracker (total: ${activeGeminiConnections.size})`);

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
      const latencyTracker = {
        wsArrivalTime: wsArrivalTime,
        authDoneTime: authDoneTime,
        dataLoadDoneTime: dataLoadDoneTime,
        wsConnectionTime: Date.now(),
        geminiOpenTime: 0,
        setupSentTime: 0,
        chunksSentTime: 0,
        primerSentTime: 0,
        setupCompleteTime: 0,
        greetingTriggerTime: 0,
        firstAudioByteTime: 0,
        greetingTriggered: false,
        ncParallelQueriesStartTime: _ncLatency.parallelQueriesStartTime,
        ncConsultantInfoResolvedTime: _ncLatency.consultantInfoResolvedTime,
        ncSettingsResolvedTime: _ncLatency.settingsResolvedTime,
        ncPreviousConversationsResolvedTime: _ncLatency.previousConversationsResolvedTime,
        ncProactiveLeadResolvedTime: _ncLatency.proactiveLeadResolvedTime,
        ncBrandVoiceResolvedTime: _ncLatency.brandVoiceResolvedTime,
        ncPromptBuildDoneTime: _ncLatency.promptBuildDoneTime,
        systemInstructionChars: systemInstruction.length,
        systemInstructionTokens: Math.round(systemInstruction.length / 4),
        previousCallContextChars: _ncLatency.previousCallContextChars,
        previousCallContextTokens: Math.round(_ncLatency.previousCallContextChars / 4),
        brandVoiceChars: _ncLatency.brandVoiceChars,
        contentPromptChars: _ncLatency.contentPromptChars,
        voiceDirectivesChars: _ncLatency.voiceDirectivesChars,
        totalContextChars: systemInstruction.length + (userDataContext ? userDataContext.length : 0) + _ncLatency.previousCallContextChars,
        totalContextTokens: Math.round((systemInstruction.length + (userDataContext ? userDataContext.length : 0) + _ncLatency.previousCallContextChars) / 4),
        previousConversationsCount: _ncLatency.previousConversationsCount,
        previousConversationsDbRows: _ncLatency.previousConversationsDbRows,
        geminiFirstResponseTime: 0,
        geminiFirstResponseType: '' as string,
        chunksSendStartTime: 0,
        chunksSendEndTime: 0,
        chunksCount: 0,
        isNonClientCall: _ncLatency.isNonClientCall,
        hasInstruction: _ncLatency.hasInstruction,
        hasCallHistory: _ncLatency.hasCallHistory,
        callDirection: _ncLatency.callDirection as string,
        promptSource: _ncLatency.promptSource as string,
      };
      
      let pendingChunksSend: (() => void) | null = null;
      let greetingAlreadySent = false;
      
      const onGeminiWsOpen = () => {
        latencyTracker.geminiOpenTime = Date.now();
        console.log(`✅ [${connectionId}] Gemini Live WebSocket opened${preConnectResult ? ' (O3: pre-connected)' : ''}`);
        console.log(`⏱️ [LATENCY] Gemini WS open: +${latencyTracker.geminiOpenTime - latencyTracker.wsConnectionTime}ms from client connection`);
        isSessionActive = true;
        
        // 🔌 Update connection tracker status
        const trackedConn = activeGeminiConnections.get(connectionId);
        if (trackedConn) {
          trackedConn.status = 'active';
          console.log(`🔌 [${connectionId}] Connection status updated to 'active'`);
        }
        
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
        // ✅ FIX RESUME: ALWAYS include system_instruction even during resume
        //    Google docs confirm: "You can change config params except model when resuming"
        //    This ensures AI has instructions even if resume handle is expired/invalid
        // ✅ DUAL BACKEND: camelCase for Google AI Studio, snake_case for Vertex AI
        let setupMessage: any;
        
        const effectiveVoice = voiceName;
        console.log(`🎙️ [${connectionId}] Voice selection: "${effectiveVoice}" (backend: ${liveApiBackend})`);
        
        if (liveApiBackend === 'google_ai_studio') {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 🔵 GOOGLE AI STUDIO: camelCase parameters, models/{id} path
          // ✅ NEW STRATEGY: Send ONLY system instruction in setup (lightweight)
          // Then send user data as chunked clientContent AFTER setupComplete
          // This avoids error 1007 (WebSocket frame size limit) while keeping full context
          // Same approach as Vertex AI — proven to work with 88K+ tokens
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          console.log(`🔵 [${connectionId}] AI Studio CHUNKED strategy: systemInstruction=${systemInstruction.length} chars (prompt only), user data=${userDataContext ? userDataContext.length : 0} chars (will be sent as chunks after setupComplete)`);
          
          setupMessage = {
            setup: {
              model: `models/${liveModelId}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: effectiveVoice
                    }
                  }
                },
                temperature: 1.0,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                thinkingConfig: {
                  thinkingBudget: voiceThinkingBudget
                }
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: {
                parts: [
                  {
                    text: systemInstruction
                  }
                ]
              },
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  startOfSpeechSensitivity: voiceVadStartSensitivity,
                  endOfSpeechSensitivity: voiceVadEndSensitivity,
                  prefixPaddingMs: 20,
                  silenceDurationMs: voiceVadSilenceMs
                }
              },
              sessionResumption: { handle: validatedResumeHandle || null }
            }
          };
        } else {
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          // 🟢 VERTEX AI: snake_case parameters, projects/.../models/{id} path
          // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          setupMessage = {
            setup: {
              model: `projects/${vertexConfig!.projectId}/locations/${vertexConfig!.location}/publishers/google/models/${liveModelId}`,
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
                max_output_tokens: 8192
              },
              input_audio_transcription: {},
              output_audio_transcription: {},
              system_instruction: {
                parts: [
                  {
                    text: systemInstruction
                  }
                ]
              },
              realtime_input_config: {
                automatic_activity_detection: {
                  disabled: false,
                  start_of_speech_sensitivity: voiceVadStartSensitivity,
                  end_of_speech_sensitivity: voiceVadEndSensitivity,
                  prefix_padding_ms: 20,
                  silence_duration_ms: voiceVadSilenceMs
                }
              },
              proactivity: {
                proactive_audio: true
              },
              enable_affective_dialog: voiceAffectiveDialog,
              session_resumption: { handle: validatedResumeHandle || null }
            }
          };
        }
        
        console.log(`🎙️ [${connectionId}] Using voice: ${voiceName}`);
        console.log(`🧠 [${connectionId}] ThinkingBudget: ${voiceThinkingBudget} (applies to entire session)`);
        console.log(`🤖 [${connectionId}] Model: ${liveModelId} [${liveApiBackend}] - Language: ITALIAN ONLY`);
        console.log(`🎙️ [${connectionId}] VAD: start=${voiceVadStartSensitivity}, end=${voiceVadEndSensitivity}, silence=${voiceVadSilenceMs}ms`);
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
        console.log(`   - Backend: ${liveApiBackend === 'google_ai_studio' ? '🔵 Google AI Studio' : '🟢 Vertex AI'}`);
        console.log(`   - Model path: ${setupMessage.setup.model}`);
        console.log(`   - System instruction length: ${systemInstruction.length} chars (always minimal)`);
        console.log(`   - Prompt mode: ${useFullPrompt ? 'FULL (complete prompt in chunks)' : 'MINIMAL (user data in chunks)'}`);
        console.log(`   - Response modalities: AUDIO`);
        console.log(`   - Voice: ${voiceName}`);
        console.log(`   - Language: it-IT`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // 🔍 DEBUG: Track system instruction for "Fresh Text Input" analysis
        const sysInstField = setupMessage.setup.system_instruction || setupMessage.setup.systemInstruction;
        if (!validatedResumeHandle && sysInstField) {
          const sysInstText = sysInstField.parts[0].text;
          
          // 🔍 NEW: Save system instruction size for breakdown analysis
          sessionSystemInstructionChars = sysInstText.length;
          sessionSystemInstructionTokens = Math.round(sysInstText.length / 4);
          
          currentTurnMessages.push({
            type: 'SETUP - System Instruction (NON-CACHED)',
            content: sysInstText.substring(0, 500) + '...',
            size: sysInstText.length,
            timestamp: new Date()
          });
          console.log(`🔍 [FRESH INPUT TRACKING] System Instruction: ${sysInstText.length} chars (~${sessionSystemInstructionTokens} tokens) - WILL BE COUNTED AS FRESH TEXT INPUT`);
          console.log(`🔍 [SESSION TRACKING] Saved sessionSystemInstructionTokens = ${sessionSystemInstructionTokens}`);
        }
        
        // 1. Send setup message
        latencyTracker.setupSentTime = Date.now();
        geminiSession.send(JSON.stringify(setupMessage));
        console.log(`✅ [${connectionId}] Setup message SENT to Gemini WebSocket - awaiting response...`);
        console.log(`⏱️ [LATENCY] Setup sent: +${latencyTracker.setupSentTime - latencyTracker.geminiOpenTime}ms from WS open`);
        
        const isResuming = !!validatedResumeHandle;
        
        if (userDataContext && !isResuming) {
          console.log(`\n📤 [${connectionId}] Sending dynamic context IMMEDIATELY after setup (cache optimization)...`);
          console.log(`   Type: ${useFullPrompt ? 'FULL PROMPT' : 'OPTIMIZED DYNAMIC CONTEXT'}`);
          console.log(`   Size: ${userDataContext.length} chars (~${Math.round(userDataContext.length / 4)} tokens)`);
          
          // Split into chunks of ~30KB each
          const CHUNK_SIZE = 30 * 1024;
          const chunks: string[] = [];
          for (let i = 0; i < userDataContext.length; i += CHUNK_SIZE) {
            const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
            const totalExpectedChunks = Math.ceil(userDataContext.length / CHUNK_SIZE);
            const marker = `\n[CHUNK_MARKER_${chunkIndex}_OF_${totalExpectedChunks}]\n`;
            chunks.push(marker + userDataContext.substring(i, i + CHUNK_SIZE));
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
              type: `CHUNK ${i + 1}/${chunks.length} - User Data Context`,
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
          
          // 🔍 CONTEXT WINDOW ANALYSIS: Show exactly where the ~27K token cutoff falls
          const VERTEX_CONTEXT_WINDOW = 27000; // ~27K text tokens observed from usageMetadata
          const contextWindowChars = VERTEX_CONTEXT_WINDOW * 4; // ~108K chars
          const systemInstructionChars = systemInstruction.length;
          const availableForContext = contextWindowChars - systemInstructionChars;
          
          console.log(`\n🔬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🔬 CONTEXT WINDOW ANALYSIS - What the AI actually "sees"`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`   📐 Estimated context window: ~${VERTEX_CONTEXT_WINDOW.toLocaleString()} text tokens (~${contextWindowChars.toLocaleString()} chars)`);
          console.log(`   📝 System instruction: ${systemInstructionChars.toLocaleString()} chars (~${Math.round(systemInstructionChars / 4).toLocaleString()} tokens)`);
          console.log(`   📦 Available for user context: ~${availableForContext.toLocaleString()} chars (~${Math.round(availableForContext / 4).toLocaleString()} tokens)`);
          console.log(`   📦 Total user context sent: ${userDataContext.length.toLocaleString()} chars (~${Math.round(userDataContext.length / 4).toLocaleString()} tokens)`);
          console.log(`   ${userDataContext.length > availableForContext ? '⚠️  OVERFLOW: ' + (userDataContext.length - availableForContext).toLocaleString() + ' chars TRUNCATED by Live API' : '✅ Fits in context window'}`);
          console.log(``);
          
          // Scan the raw userDataContext for section markers
          const sectionMarkers = [
            { name: '⏰ DATA/ORA', pattern: '⏰ DATA E ORA' },
            { name: '🚨 DATI FINANZIARI', pattern: '🚨 DATI FINANZIARI REALI' },
            { name: '👤 INFO UTENTE', pattern: '👤 INFO UTENTE' },
            { name: '📚 ESERCIZI', pattern: '📚 ESERCIZI' },
            { name: '📖 DOCUMENTI BIBLIOTECA', pattern: '📖 DOCUMENTI BIBLIOTECA' },
            { name: '📊 STATISTICHE MOMENTUM', pattern: '📊 STATISTICHE MOMENTUM' },
            { name: '📅 EVENTI CALENDARIO', pattern: '📅 EVENTI CALENDARIO' },
            { name: '📞 CONSULENZE', pattern: '📞 CONSULENZE' },
            { name: '🔜 CONSULENZE IN PROGRAMMA', pattern: '🔜 CONSULENZE IN PROGRAMMA' },
            { name: '✅ CONSULENZE RECENTI', pattern: '✅ CONSULENZE RECENTI COMPLETATE' },
            { name: '📧 RIEPILOGO EMAIL', pattern: '📧 RIEPILOGO EMAIL CONSULENZA' },
            { name: '🎙️ TRASCRIZIONE FATHOM', pattern: '🎙️ TRASCRIZIONE FATHOM' },
            { name: '✅ FINE DATI UTENTE', pattern: '✅ FINE DATI UTENTE' },
            { name: '📋 TASK CONSULENZE', pattern: 'TASK' },
          ];
          
          console.log(`   📋 SECTION MAP (position in context):`);
          console.log(`   ${'─'.repeat(70)}`);
          
          const foundSections: { name: string; pos: number; tokens: number }[] = [];
          for (const marker of sectionMarkers) {
            const pos = userDataContext.indexOf(marker.pattern);
            if (pos >= 0) {
              foundSections.push({ name: marker.name, pos, tokens: Math.round(pos / 4) });
            }
          }
          foundSections.sort((a, b) => a.pos - b.pos);
          
          for (const section of foundSections) {
            const inWindow = section.pos < availableForContext;
            const icon = inWindow ? '✅' : '❌';
            console.log(`   ${icon} ${section.name.padEnd(30)} @ char ${section.pos.toLocaleString().padStart(8)} (~${section.tokens.toLocaleString().padStart(6)} tokens) ${!inWindow ? '← FUORI DAL CONTEXT WINDOW' : ''}`);
          }
          
          console.log(`   ${'─'.repeat(70)}`);
          console.log(`   ✂️  CUTOFF LINE: char ${availableForContext.toLocaleString()} (~${Math.round(availableForContext / 4).toLocaleString()} tokens)`);
          console.log(`   📦 Total context: char ${userDataContext.length.toLocaleString()} (~${Math.round(userDataContext.length / 4).toLocaleString()} tokens)`);
          
          // Show what percentage of each section is visible
          const cutoffPos = availableForContext;
          let prevPos = 0;
          console.log(`\n   📊 SECTION SIZES & VISIBILITY:`);
          console.log(`   ${'─'.repeat(70)}`);
          for (let i = 0; i < foundSections.length; i++) {
            const section = foundSections[i];
            const nextPos = i < foundSections.length - 1 ? foundSections[i + 1].pos : userDataContext.length;
            const sectionSize = nextPos - section.pos;
            const sectionTokens = Math.round(sectionSize / 4);
            const visibleChars = Math.max(0, Math.min(nextPos, cutoffPos) - section.pos);
            const visiblePct = sectionSize > 0 ? Math.round((visibleChars / sectionSize) * 100) : 0;
            const bar = visiblePct === 100 ? '████████████████████' : 
                        visiblePct > 0 ? '████████████████████'.substring(0, Math.round(visiblePct / 5)) + '░░░░░░░░░░░░░░░░░░░░'.substring(0, 20 - Math.round(visiblePct / 5)) : 
                        '░░░░░░░░░░░░░░░░░░░░';
            console.log(`   ${visiblePct === 100 ? '✅' : visiblePct > 0 ? '⚠️' : '❌'} ${section.name.padEnd(30)} ${sectionTokens.toLocaleString().padStart(6)} tok  [${bar}] ${visiblePct}%`);
          }
          console.log(`   ${'─'.repeat(70)}`);
          console.log(`🔬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          const shouldSpeakFirst = (mode === 'assistenza' || mode === 'consulente' || mode === 'phone_service') && !isResuming;
          
          const sendChunksAndPrimer = () => {
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⏳ Sending chunks to Gemini Live API...`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            const primerContent = `📋 CONTEXT_END - All user data loaded and ready.

${shouldSpeakFirst ? `🎬 NOTA: Stai per ricevere un comando di avvio sessione. Preparati a salutare l'utente.` : `🚨 REGOLA CRITICA - ASPETTA IL CLIENTE:
NON iniziare a parlare tu per primo!
ASPETTA che il cliente dica qualcosa (anche solo "pronto" o "ciao").
Solo DOPO che il cliente ha parlato, puoi iniziare con il benvenuto.
Se il cliente non parla entro 5 secondi, puoi fare un breve "Buongiorno, mi senti?"
MA NON iniziare con lo script completo finché il cliente non risponde!`}`;
            
            // ✅ UNIFIED CHUNKED STRATEGY: Both Google AI Studio and Vertex AI use the same approach
            // Send all data chunks FIRST (turnComplete: false), then primer LAST (turnComplete: true)
            const backendLabel = liveApiBackend === 'google_ai_studio' ? '🔵 GOOGLE AI STUDIO' : '🟢 VERTEX AI';
            console.log(`🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🎯 ${backendLabel} - CHUNKED MESSAGES`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`   💡 Strategy: Send all ${chunks.length} data chunks FIRST`);
            console.log(`   💡 Then: Send minimal primer chunk LAST (with turnComplete: true)`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            latencyTracker.chunksSendStartTime = Date.now();
            
            if (liveApiBackend === 'google_ai_studio') {
              // 🔵 Google AI Studio: camelCase clientContent
              // ⚠️ LIMIT: Send only first 4 chunks to test (~30K tokens)
              // Google AI Studio may have stricter limits on clientContent size
              const maxChunksForAIStudio = 7;
              const chunksToSend = Math.min(chunks.length, maxChunksForAIStudio);
              console.log(`   ⚠️ Google AI Studio: limiting to first ${chunksToSend}/${chunks.length} chunks (~${Math.round(chunksToSend * 30 * 1024 / 4).toLocaleString()} tokens)`);
              
              for (let i = 0; i < chunksToSend; i++) {
                const chunkTokens = Math.round(chunks[i].length / 4);
                const chunkMessage = {
                  clientContent: {
                    turns: [{
                      role: 'user',
                      parts: [{ text: chunks[i] }]
                    }],
                    turnComplete: false
                  }
                };
                geminiSession.send(JSON.stringify(chunkMessage));
                console.log(`   ✅ Chunk ${i + 1}/${chunksToSend} sent - ${chunks[i].length} chars (~${chunkTokens.toLocaleString()} tokens)`);
              }
              if (chunksToSend < chunks.length) {
                console.log(`   ⏭️ Skipped chunks ${chunksToSend + 1}-${chunks.length} (Google AI Studio limit test)`);
              }
              
              const primerTokens = Math.round(primerContent.length / 4);
              const primerTurnComplete = shouldSpeakFirst ? false : true;
              const primerMessage = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: primerContent }]
                  }],
                  turnComplete: primerTurnComplete
                }
              };
              geminiSession.send(JSON.stringify(primerMessage));
              latencyTracker.primerSentTime = Date.now();
              latencyTracker.chunksSentTime = latencyTracker.primerSentTime;
              latencyTracker.chunksCount = chunksToSend;
              latencyTracker.chunksSendEndTime = Date.now();
              console.log(`\n   🎯 Primer chunk sent - ${primerContent.length} chars (~${primerTokens} tokens)`);
              console.log(`   ${primerTurnComplete ? '✅ turnComplete: true (commits all chunks, AI waits for client)' : '⏳ turnComplete: false (greeting trigger will commit all chunks)'}`);
              console.log(`⏱️ [LATENCY] Chunks send: start=${latencyTracker.chunksSendStartTime - latencyTracker.wsArrivalTime}ms, end=${latencyTracker.chunksSendEndTime - latencyTracker.wsArrivalTime}ms, duration=${latencyTracker.chunksSendEndTime - latencyTracker.chunksSendStartTime}ms, count=${latencyTracker.chunksCount}`);
            } else {
              // 🟢 Vertex AI: same chunked approach
              for (let i = 0; i < chunks.length; i++) {
                const chunkTokens = Math.round(chunks[i].length / 4);
                const chunkMessage = {
                  clientContent: {
                    turns: [{
                      role: 'user',
                      parts: [{ text: chunks[i] }]
                    }],
                    turnComplete: false
                  }
                };
                geminiSession.send(JSON.stringify(chunkMessage));
                console.log(`   ✅ Chunk ${i + 1}/${chunks.length} sent - ${chunks[i].length} chars (~${chunkTokens.toLocaleString()} tokens)`);
              }
              
              const primerTokens = Math.round(primerContent.length / 4);
              const primerTurnComplete = shouldSpeakFirst ? false : true;
              const primerMessage = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: primerContent }]
                  }],
                  turnComplete: primerTurnComplete
                }
              };
              geminiSession.send(JSON.stringify(primerMessage));
              latencyTracker.primerSentTime = Date.now();
              latencyTracker.chunksSentTime = latencyTracker.primerSentTime;
              latencyTracker.chunksCount = chunks.length;
              latencyTracker.chunksSendEndTime = Date.now();
              console.log(`\n   🎯 Primer chunk sent - ${primerContent.length} chars (~${primerTokens} tokens)`);
              console.log(`   ${primerTurnComplete ? '✅ turnComplete: true (commits all chunks, AI waits for client)' : '⏳ turnComplete: false (greeting trigger will commit all chunks)'}`);
              console.log(`⏱️ [LATENCY] Chunks send: start=${latencyTracker.chunksSendStartTime - latencyTracker.wsArrivalTime}ms, end=${latencyTracker.chunksSendEndTime - latencyTracker.wsArrivalTime}ms, duration=${latencyTracker.chunksSendEndTime - latencyTracker.chunksSendStartTime}ms, count=${latencyTracker.chunksCount}`);
            }
            
            console.log(`⏱️ [LATENCY] All chunks + primer sent: +${latencyTracker.primerSentTime - latencyTracker.setupSentTime}ms from setup sent, total: +${latencyTracker.primerSentTime - latencyTracker.wsConnectionTime}ms`);
            if (shouldSpeakFirst) {
              console.log(`   🎬 AI primed to SPEAK FIRST with greeting (mode: ${mode})\n`);
            } else {
              console.log(`   🚨 AI instructed to WAIT for client to speak first\n`);
            }
            
            currentTurnMessages.push({
              type: 'PRIMER CHUNK at END - Cache Optimization',
              content: primerContent,
              size: primerContent.length,
              timestamp: new Date()
            });
            
            console.log(`\n🎉 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`✅ [${connectionId}] ALL ${chunks.length} CHUNKS SENT (chunked, turnComplete: false)`);
            console.log(`   📦 Chunks will be committed to context when next turnComplete: true is sent`);
            console.log(`   🎙️ Context ready: ~${Math.round(userDataContext!.length / 4)} tokens waiting for commit`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          };
          
          if (liveApiBackend === 'google_ai_studio') {
            console.log(`⏳ [${connectionId}] Google AI Studio: deferring chunks until setupComplete (protocol requirement)...`);
            pendingChunksSend = sendChunksAndPrimer;
          } else {
            sendChunksAndPrimer();
          }
        } else if (isResuming) {
          console.log(`\n⏩ [${connectionId}] RESUMING - Skipping dynamic context (preserved in session)`);
        }
      };
      
      // O3: If WS was pre-connected, it's already OPEN - invoke handler directly
      if (preConnectResult && geminiSession.readyState === WebSocket.OPEN) {
        console.log(`🚀 [${connectionId}] O3: WS already OPEN from pre-connect, invoking open handler immediately`);
        onGeminiWsOpen();
      } else {
        geminiSession.on('open', onGeminiWsOpen);
      }

      // 🔍 DEBUG: Counter for message logging
      let geminiMessageCount = 0;
      
      geminiSession.on('message', async (data: Buffer) => {
        if (!isSessionActive) return;
        
        geminiMessageCount++;
        
        // 🔍 DEBUG: Log RAW data BEFORE JSON parsing to debug "Invalid frame header" errors
        const rawDataStr = data.toString();
        const rawDataLength = data.length;
        const rawDataPreview = rawDataStr.substring(0, 200);
        
        // Log first message in detail, then only if it looks suspicious
        const isFirstChars = rawDataStr.substring(0, 20);
        const looksLikeJson = isFirstChars.trim().startsWith('{') || isFirstChars.trim().startsWith('[');
        
        // ALWAYS log basic metadata for first 5 messages and any suspicious ones
        if (geminiMessageCount <= 5) {
          console.log(`📥 [${connectionId}] RAW MSG #${geminiMessageCount}: ${rawDataLength} bytes, starts with: "${isFirstChars.replace(/\n/g, '\\n')}"`);
        }
        
        // Log detailed info for suspicious messages (non-JSON or very short)
        if (!looksLikeJson || rawDataLength < 10) {
          console.log(`\n🚨 [${connectionId}] SUSPICIOUS RAW MESSAGE #${geminiMessageCount}:`);
          console.log(`   Length: ${rawDataLength} bytes`);
          console.log(`   First 20 chars: "${isFirstChars}"`);
          console.log(`   Hex dump (first 50 bytes): ${data.slice(0, 50).toString('hex')}`);
          console.log(`   Full preview: "${rawDataPreview}"`);
        }
        
        try {
          const response = JSON.parse(data.toString());

          if (latencyTracker.greetingTriggered && latencyTracker.geminiFirstResponseTime === 0) {
            latencyTracker.geminiFirstResponseTime = Date.now();
            if (response.setupComplete) {
              latencyTracker.geminiFirstResponseType = 'setupComplete';
            } else if (response.serverContent?.modelTurn?.parts) {
              const parts = response.serverContent.modelTurn.parts;
              if (parts.some((p: any) => p.inlineData?.data)) {
                latencyTracker.geminiFirstResponseType = 'audio';
              } else if (parts.some((p: any) => p.text)) {
                latencyTracker.geminiFirstResponseType = 'text';
              } else {
                latencyTracker.geminiFirstResponseType = 'other_serverContent';
              }
            } else {
              latencyTracker.geminiFirstResponseType = 'other';
            }
            console.log(`⏱️ [LATENCY] First Gemini response after greeting: +${latencyTracker.geminiFirstResponseTime - latencyTracker.greetingTriggerTime}ms (type: ${latencyTracker.geminiFirstResponseType})`);
          }
          // Log ridotto - non logghiamo ogni singolo response, solo eventi importanti
          
          // Setup complete response
          if (response.setupComplete) {
            latencyTracker.setupCompleteTime = Date.now();
            if (latencyTracker.primerSentTime === 0) {
              latencyTracker.primerSentTime = latencyTracker.setupSentTime;
              latencyTracker.chunksSentTime = latencyTracker.setupSentTime;
            }
            const fromPrimer = latencyTracker.primerSentTime > 0
              ? `+${latencyTracker.setupCompleteTime - latencyTracker.primerSentTime}ms from primer sent`
              : `(no primer sent)`;
            console.log(`✅ [${connectionId}] Gemini Live session ready`);
            console.log(`⏱️ [LATENCY] setupComplete received: ${fromPrimer}, total: +${latencyTracker.setupCompleteTime - latencyTracker.wsConnectionTime}ms`);
            clientWs.send(JSON.stringify({ 
              type: 'ready',
              message: 'Gemini Live session ready',
              voice: voiceName
            }));
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 📦 CONTEXT-FIRST STRATEGY: Send ALL context chunks BEFORE greeting
            // The greeting trigger (turnComplete: true) commits all preceding
            // clientContent chunks into the context window. Without this order,
            // chunks sent AFTER a turnComplete: true are left in "pending" state
            // and never enter the AI's context (known Live API behavior).
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

            if (pendingChunksSend) {
              console.log(`\n📤 [${connectionId}] Sending context chunks FIRST (before greeting trigger)...`);
              pendingChunksSend();
              pendingChunksSend = null;
            }

            const shouldGreetEarly = (mode === 'assistenza' || mode === 'consulente' || mode === 'phone_service') && !validatedResumeHandle;

            if (isPhoneCall && _ncLatency.deferredCallHistory) {
              const historyChunk = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: _ncLatency.deferredCallHistory }]
                  }],
                  turnComplete: false
                }
              };
              geminiSession.send(JSON.stringify(historyChunk));
              console.log(`📚 [${connectionId}] Deferred call history sent BEFORE greeting (${_ncLatency.deferredCallHistory.length} chars)`);
            }

            if (isPhoneCall && _ncLatency.deferredContentChunk) {
              const contentChunk = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: _ncLatency.deferredContentChunk }]
                  }],
                  turnComplete: false
                }
              };
              geminiSession.send(JSON.stringify(contentChunk));
              console.log(`📚 [${connectionId}] Deferred content sent BEFORE greeting (${_ncLatency.deferredContentChunk.length} chars)`);
            }

            if (shouldGreetEarly) {
              const earlyGreetingMessage = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: '[SISTEMA] La sessione è iniziata. L\'utente è in linea e ti sta ascoltando. Inizia SUBITO a parlare con un saluto naturale e breve. IMPORTANTE: Parti con il MASSIMO dell\'energia vocale dalla primissima sillaba — voce ALTA, squillante, sorridente! Se conosci il nome della persona, usalo nel saluto (es: "Marco? Sì ciao, sono [tuo nome]..."). Se non lo conosci, presentati comunque brevemente (es: "Ciao, sono [tuo nome]..."). NON aspettare che l\'utente parli per primo. Parti tu immediatamente con tono ESPLOSIVO e carico!' }]
                  }],
                  turnComplete: true
                }
              };
              geminiSession.send(JSON.stringify(earlyGreetingMessage));
              latencyTracker.greetingTriggerTime = Date.now();
              latencyTracker.greetingTriggered = true;
              greetingAlreadySent = true;
              console.log(`🚀 [${connectionId}] GREETING sent AFTER all context chunks (turnComplete: true commits ~${sessionInitialChunkTokens.toLocaleString()} context tokens)`);
              console.log(`⏱️ [LATENCY] Greeting trigger: +${latencyTracker.greetingTriggerTime - latencyTracker.setupCompleteTime}ms from setupComplete, total: +${latencyTracker.greetingTriggerTime - latencyTracker.wsConnectionTime}ms`);
              
              clientWs.send(JSON.stringify({
                type: 'ai_starting',
                message: 'AI sta iniziando con il saluto'
              }));
            }
            
            // O6 REMOVED: Slots are now loaded inline at O5 and included in the system prompt directly
            
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
              
              // 🦮 Start super-watchdog to detect stuck flags
              startSuperWatchdog();
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
            
            if (validatedResumeHandle) {
              if (conversationHistory && conversationHistory.length > 0) {
                // SESSION RESUMPTION with history: Skip expensive replay to Gemini
                console.log(`\n╔${'═'.repeat(78)}╗`);
                console.log(`║ 🔄 [${connectionId}] SESSION RESUMPTION - Skipping Gemini history replay ${' '.repeat(18)} ║`);
                console.log(`╠${'═'.repeat(78)}╣`);
                console.log(`║ ✅ Gemini restored context from session handle (FREE)${' '.repeat(23)} ║`);
                console.log(`║ ⚡ Skipped resending ${conversationHistory.length} messages - saves ~$0.05 per reconnect${' '.repeat(19 - String(conversationHistory.length).length)} ║`);
                console.log(`║ 📊 Database loaded: ${conversationHistory.length} messages (needed for prompt/persistence)${' '.repeat(15 - String(conversationHistory.length).length)} ║`);
                console.log(`╚${'═'.repeat(78)}╝\n`);
              } else {
                console.log(`🔄 [${connectionId}] SESSION RESUMPTION - No conversation history (phone call or new session)`);
              }
              
              // 🔧 FIX: After resume, AI should STAY SILENT and wait for user
              // Applies to ALL modes (sales_agent, phone_service, assistenza, etc.)
              console.log(`🔇 [${connectionId}] RESUME: AI will stay SILENT until user speaks`);
              console.log(`   → NO greeting, NO turnComplete:true message sent`);
              console.log(`   → AI waits for user to speak first after reconnection`);
              console.log(`   → suppressAiOutputAfterResume = true (blocking AI audio output)`);
              
              // 🔇 CRITICAL: Activate post-resume silence mode
              // This will block ALL AI audio output until the user speaks
              suppressAiOutputAfterResume = true;
              prospectHasSpoken = false;
            }
            
            if (shouldReplayHistory) {
              
              console.log(`\n╔${'═'.repeat(78)}╗`);
              console.log(`║ 📚 [${connectionId}] RESTORING HISTORY (BATCH MODE - INSTANT) ${' '.repeat(23)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ Total messages: ${String(conversationHistory.length).padEnd(57)} ║`);
              console.log(`║ First message: ${conversationHistory[0].timestamp.toLocaleTimeString('it-IT').padEnd(59)} ║`);
              console.log(`║ Last message: ${conversationHistory[conversationHistory.length - 1].timestamp.toLocaleTimeString('it-IT').padEnd(60)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ 🚀 OPTIMIZATION: Sending ALL messages in 1 batch (0 network latency)      ║`);
              console.log(`╚${'═'.repeat(78)}╝\n`);
              
              // 🚀 OPTIMIZATION: Map entire history to array of turns and send in ONE batch
              // This reduces send time from ~2-3 seconds to milliseconds
              const allTurns = conversationHistory.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
              }));
              
              // Create ONE giant payload with all turns
              const fullHistoryMessage = {
                clientContent: {
                  turns: allTurns,
                  turnComplete: true
                }
              };
              
              // Send everything in one shot (0 additional network latency)
              geminiSession.send(JSON.stringify(fullHistoryMessage));
              
              console.log(`✅ [${connectionId}] SENT ${allTurns.length} MESSAGES IN 1 BATCH (instant!)`);
              
              // Track for logs (optional, for debug)
              currentTurnMessages.push({
                type: `HISTORY BATCH (${allTurns.length} msgs) - Instant Restore`,
                content: `Restored history of ${allTurns.length} turns in 1 batch`,
                size: JSON.stringify(allTurns).length,
                timestamp: new Date()
              });
              
              console.log(`\n╔${'═'.repeat(78)}╗`);
              console.log(`║ 🎉 [${connectionId}] CONVERSATION HISTORY RESTORED INSTANTLY ${' '.repeat(24)} ║`);
              console.log(`╠${'═'.repeat(78)}╣`);
              console.log(`║ Gemini Live now has complete context of previous ${conversationHistory.length} messages${' '.repeat(20 - String(conversationHistory.length).length)} ║`);
              console.log(`║ AI can continue conversation from where it was interrupted${' '.repeat(17)} ║`);
              console.log(`╚${'═'.repeat(78)}╝\n`);
              
              // Notify client that history restoration is complete
              clientWs.send(JSON.stringify({
                type: 'history_restored',
                message: 'Conversazione ripristinata istantaneamente',
                messagesRestored: conversationHistory.length
              }));
            }
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🎬 START AI IMMEDIATELY WITH SCRIPT (NEW sessions only)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // For NEW sales_agent/consultation_invite sessions (not resume), 
            // tell the AI to start speaking immediately with the opening script.
            // This ensures the prospect hears the greeting as soon as they connect.
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            const isNewSalesSession = (mode === 'sales_agent' || mode === 'consultation_invite') && !validatedResumeHandle;
            
            if (isNewSalesSession) {
              console.log(`\n🎬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`[${connectionId}] STARTING AI WITH OPENING SCRIPT`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`   Mode: ${mode}`);
              console.log(`   Is Resume: NO (new session)`);
              console.log(`   Action: AI will speak first with greeting`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              // Send command to make AI start speaking immediately
              const startScriptMessage = {
                clientContent: {
                  turns: [{
                    role: 'user',
                    parts: [{ text: '[SISTEMA] La sessione è iniziata. Il prospect è in linea e ti sta ascoltando. Inizia SUBITO con il saluto di apertura dello script. Presentati e inizia la conversazione. NON aspettare che il prospect parli per primo.' }]
                  }],
                  turnComplete: true  // IMPORTANT: turnComplete:true triggers AI response
                }
              };
              
              geminiSession.send(JSON.stringify(startScriptMessage));
              console.log(`🎬 [${connectionId}] START SCRIPT command sent - AI will speak first`);
              
              // Notify client that AI is about to start speaking
              clientWs.send(JSON.stringify({
                type: 'ai_starting',
                message: 'AI sta iniziando con lo script di apertura'
              }));
            }
            
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // 🎬 START AI IMMEDIATELY WITH GREETING (assistenza/consulente/phone_service)
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // For NEW assistenza/consulente/phone_service sessions (not resume),
            // tell the AI to start speaking immediately with a natural greeting.
            // If the AI knows the user's name (from system prompt), it uses it:
            //   "Marco? Sì ciao, sono [AI name] da [business]..."
            // If not, a simple greeting:
            //   "Ciao, sono [AI name] da [business]..."
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            const isNewAssistantOrPhoneSession = (mode === 'assistenza' || mode === 'consulente' || mode === 'phone_service') && !validatedResumeHandle;
            
            if (isNewAssistantOrPhoneSession && !greetingAlreadySent) {
              {
                console.log(`\n🎬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[${connectionId}] STARTING AI WITH IMMEDIATE GREETING (${liveApiBackend === 'google_ai_studio' ? '🔵 AI Studio' : '🟢 Vertex AI'}) [FALLBACK - early greeting didn't fire]`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`   Mode: ${mode}`);
                console.log(`   Is Resume: NO (new session)`);
                console.log(`   Action: AI will speak first with natural greeting`);
                console.log(`   Note: Sending explicit greeting trigger (primer alone may not be sufficient)`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                
                const startGreetingMessage = {
                  clientContent: {
                    turns: [{
                      role: 'user',
                      parts: [{ text: '[SISTEMA] La sessione è iniziata. L\'utente è in linea e ti sta ascoltando. Inizia SUBITO a parlare con un saluto naturale e breve. IMPORTANTE: Parti con il MASSIMO dell\'energia vocale dalla primissima sillaba — voce ALTA, squillante, sorridente! Se conosci il nome della persona, usalo nel saluto (es: "Marco? Sì ciao, sono [tuo nome]..."). Se non lo conosci, presentati comunque brevemente (es: "Ciao, sono [tuo nome]..."). NON aspettare che l\'utente parli per primo. Parti tu immediatamente con tono ESPLOSIVO e carico!' }]
                    }],
                    turnComplete: true
                  }
                };
                
                if (isPhoneCall && _ncLatency.deferredCallHistory) {
                  const historyChunk = {
                    clientContent: {
                      turns: [{
                        role: 'user',
                        parts: [{ text: _ncLatency.deferredCallHistory }]
                      }],
                      turnComplete: false
                    }
                  };
                  geminiSession.send(JSON.stringify(historyChunk));
                  console.log(`📚 [${connectionId}] Deferred call history sent BEFORE greeting (${_ncLatency.deferredCallHistory.length} chars) - Gemini has context for personalized greeting`);
                }

                geminiSession.send(JSON.stringify(startGreetingMessage));
                latencyTracker.greetingTriggerTime = Date.now();
                latencyTracker.greetingTriggered = true;
                console.log(`🎬 [${connectionId}] GREETING command sent - AI will speak first (mode: ${mode}, backend: ${liveApiBackend})`);
                console.log(`⏱️ [LATENCY] Greeting trigger sent: +${latencyTracker.greetingTriggerTime - latencyTracker.setupCompleteTime}ms from setupComplete, total: +${latencyTracker.greetingTriggerTime - latencyTracker.wsConnectionTime}ms`);
              }
              
              clientWs.send(JSON.stringify({
                type: 'ai_starting',
                message: 'AI sta iniziando con il saluto'
              }));
            } else if (isNewAssistantOrPhoneSession && greetingAlreadySent) {
              console.log(`✅ [${connectionId}] Greeting already sent early (O2) - skipping duplicate`);
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
            goAwayReceived = true;
            console.log(`\n⚠️━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⏰ [${connectionId}] GO AWAY NOTIFICATION RECEIVED`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Reason: ${JSON.stringify(response.goAway)}`);
            console.log(`⚠️  Session will close in ~60 seconds due to 10-minute timeout`);
            if (isPhoneCall) {
              console.log(`📞 AUTO-RECONNECT: Phone call detected - will auto-reconnect with session handle when Gemini closes`);
              console.log(`   → lastSessionHandle available: ${!!lastSessionHandle}`);
            } else {
              console.log(`💡 User should see a notification to continue the conversation`);
            }
            
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
            const outputTokens = usage.responseTokenCount || 0; // Audio output tokens
            const cachedTokens = usage.cachedContentTokenCount || 0; // Cached input tokens (94% savings!)
            const thinkingTokens = usage.thoughtsTokenCount || 0; // Thinking/reasoning tokens
            
            // 🔬 DEBUG: Log FULL usageMetadata to see if there are hidden fields
            console.log(`\n🔬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🔬 FULL GEMINI usageMetadata (to see ALL available fields):`);
            console.log(JSON.stringify(usage, null, 2));
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // Audio metrics (if available in metadata)
            const audioInputSeconds = usage.audioInputSeconds || 0;
            const audioOutputSeconds = usage.audioOutputSeconds || 0;
            
            // 🔍 NEW: Extract promptTokensDetails for breakdown analysis
            const promptDetails = usage.promptTokensDetails || [];
            let textInputTokens = 0;
            let audioInputTokens = 0;
            promptDetails.forEach((detail: { modality: string; tokenCount: number }) => {
              if (detail.modality === 'TEXT') textInputTokens = detail.tokenCount;
              if (detail.modality === 'AUDIO') audioInputTokens = detail.tokenCount;
            });
            
            // 🔍 NEW: Increment turn count for tracking
            sessionTurnCount++;
            
            // 🔍 NEW: Calculate conversation history tokens (estimate from saved messages)
            const conversationHistoryTokens = conversationMessages.reduce((acc, msg) => {
              return acc + Math.round(msg.transcript.length / 4);
            }, 0);
            
            // 🔍 TASK 3 & 4: Log detailed "Fresh Text Input" breakdown + Cache analysis
            if (inputTokens > 0 || cachedTokens > 0) {
              console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`🔍 [FRESH TOKEN COMPOSITION ANALYSIS] - Turn #${sessionTurnCount}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              
              console.log(`\n📊 GEMINI promptTokensDetails BREAKDOWN:`);
              console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
              console.log(`   │ TEXT tokens:  ${String(textInputTokens.toLocaleString()).padEnd(10)} (~${(textInputTokens / 1000).toFixed(1)}k)        │`);
              console.log(`   │ AUDIO tokens: ${String(audioInputTokens.toLocaleString()).padEnd(10)} (user voice input)     │`);
              console.log(`   │ TOTAL:        ${String(inputTokens.toLocaleString()).padEnd(10)} (promptTokenCount)     │`);
              console.log(`   └─────────────────────────────────────────────────────────────┘`);
              
              console.log(`\n🧮 ESTIMATED TEXT TOKEN COMPOSITION:`);
              console.log(`   ┌─────────────────────────────────────────────────────────────┐`);
              console.log(`   │ 1. System Instruction:      ~${String(sessionSystemInstructionTokens.toLocaleString()).padEnd(8)} tokens            │`);
              console.log(`   │    (${sessionSystemInstructionChars.toLocaleString()} chars, sent in setup)                      │`);
              console.log(`   │                                                             │`);
              console.log(`   │ 2. Conversation History:    ~${String(conversationHistoryTokens.toLocaleString()).padEnd(8)} tokens            │`);
              console.log(`   │    (${conversationMessages.length} messages saved)                               │`);
              console.log(`   │                                                             │`);
              console.log(`   │ 3. Initial Chunks:          ~${String(sessionInitialChunkTokens.toLocaleString()).padEnd(8)} tokens            │`);
              console.log(`   │    (sent at session start)                                  │`);
              console.log(`   └─────────────────────────────────────────────────────────────┘`);
              
              const estimatedTotal = sessionSystemInstructionTokens + conversationHistoryTokens + sessionInitialChunkTokens;
              const overhead = textInputTokens - estimatedTotal;
              
              console.log(`\n🎯 ANALYSIS:`);
              console.log(`   • Actual TEXT tokens from Gemini: ${textInputTokens.toLocaleString()}`);
              console.log(`   • Our estimate (sysInst + history + chunks): ${estimatedTotal.toLocaleString()}`);
              console.log(`   • Gemini overhead/tokenizer diff: ${overhead.toLocaleString()} tokens`);
              
              if (sessionInitialChunkTokens > 0) {
                const chunkRatio = textInputTokens > 0 ? (sessionInitialChunkTokens / textInputTokens) * 100 : 0;
                console.log(`\n   📦 Context Verification:`);
                console.log(`   - Chunks in context: ~${sessionInitialChunkTokens.toLocaleString()} tokens (${chunkRatio.toFixed(0)}% of total)`);
                console.log(`   ✅ Chunks are IN the context window (Live API counts them in promptTokenCount)`);
                console.log(`   ℹ️  Live API does NOT report cachedContentTokenCount — this is normal behavior`);
              }
              
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
              
              if (currentTurnMessages.length > 0) {
                console.log(`📋 Messages sent in this turn:`);
                let totalChars = 0;
                let chunkCount = 0;
                currentTurnMessages.forEach((msg, idx) => {
                  console.log(`   ${idx + 1}. ${msg.type}`);
                  console.log(`      Size: ${msg.size.toLocaleString()} chars (~${Math.round(msg.size / 4)} tokens)`);
                  console.log(`      Preview: "${msg.content.substring(0, 100)}..."`);
                  totalChars += msg.size;
                  if (msg.type.includes('CHUNK')) chunkCount++;
                });
                console.log(`\n   📊 TOTAL SENT: ${totalChars.toLocaleString()} chars (~${Math.round(totalChars / 4)} estimated tokens)`);
                console.log(`   📊 ACTUAL FRESH INPUT TOKENS: ${inputTokens.toLocaleString()} tokens`);
                
                // 🔍 TASK 3: Chunk-specific cache analysis
                if (chunkCount > 0) {
                  console.log(`\n   🎯 CHUNK ANALYSIS:`);
                  console.log(`      • Chunks sent: ${chunkCount}`);
                  console.log(`      • Expected to be CACHED after first turn`);
                  console.log(`      • If this is NOT the first turn, these should appear as CACHED tokens, not FRESH!`);
                }
              } else {
                console.log(`⚠️  No messages tracked in current turn (Turn #${sessionTurnCount})`);
                console.log(`   This is normal for turns after the first - audio-only input`);
              }
              
              // 🔍 TASK 3: DETAILED CACHE ANALYSIS
              console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`💾 CACHE PERFORMANCE ANALYSIS`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              
              if (cachedTokens > 0) {
                console.log(`✅ CACHED TOKENS DETECTED: ${cachedTokens.toLocaleString()} tokens`);
                console.log(`   💰 Cost: $${((cachedTokens / 1_000_000) * 0.03).toFixed(6)} ($0.03/1M)`);
              } else {
                console.log(`ℹ️  cachedContentTokenCount = 0 (normal for Live API)`);
                console.log(`   Live API uses implicit session memory — chunks are in promptTokenCount.`);
                console.log(`   Cost: $${((inputTokens / 1_000_000) * 0.50).toFixed(6)} (${inputTokens.toLocaleString()} tokens × $0.50/1M)`);
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
            totalThinkingTokens += thinkingTokens;
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
              console.log(`   • Included in promptTokenCount each turn (Live API behavior)`);
              
              console.log(`\n📊 Actual Gemini Reporting:`);
              console.log(`   • Fresh Text Input: ${totalInputTokens.toLocaleString()} tokens`);
              console.log(`   • Cached Tokens: ${totalCachedTokens.toLocaleString()} tokens`);
              console.log(`   • Total Input: ${(totalInputTokens + totalCachedTokens).toLocaleString()} tokens`);
              
              const avgTokensPerTurn = sessionTurnCount > 0 ? Math.round(totalInputTokens / sessionTurnCount) : totalInputTokens;
              const chunkCostPerTurn = (sessionInitialChunkTokens / 1_000_000) * PRICE_INPUT_PER_1M;
              
              console.log(`\n🎯 ANALYSIS:`);
              if (totalCachedTokens === 0) {
                console.log(`   ℹ️  cachedContentTokenCount = 0 (normal for Live API)`);
                console.log(`   • Live API does NOT expose cache metrics via this field`);
                console.log(`   • Chunks (${sessionInitialChunkTokens.toLocaleString()} tokens) are counted in promptTokenCount every turn`);
                console.log(`   • Avg input per turn: ~${avgTokensPerTurn.toLocaleString()} tokens`);
                console.log(`   • Chunk context cost per turn: ~$${chunkCostPerTurn.toFixed(6)}`);
              } else {
                const cacheEfficiency = (totalCachedTokens / sessionInitialChunkTokens) * 100;
                if (cacheEfficiency >= 90) {
                  console.log(`   ✅ EXCELLENT: Cache is working perfectly!`);
                  console.log(`   • ${cacheEfficiency.toFixed(1)}% of initial chunks are being cached`);
                  console.log(`   • Saving ~$${cacheSavings.toFixed(6)} per session`);
                } else if (cacheEfficiency >= 50) {
                  console.log(`   ⚠️  PARTIAL: Cache is working but not optimal`);
                  console.log(`   • Only ${cacheEfficiency.toFixed(1)}% of initial chunks are cached`);
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
                modelName: liveModelId || 'gemini-live-2.5-flash-native-audio',
                
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
                  thinkingTokens: thinkingTokens,
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

          // 🆕 FIX: Flag modelResponsePending appena riceviamo QUALSIASI serverContent
          // Questo segnala al watchdog che Gemini sta elaborando, anche se non ha ancora inviato audio
          if (response.serverContent && userMessagePendingResponse) {
            modelResponsePending = true;
            console.log(`🔔 [${connectionId}] modelResponsePending=true (Gemini sta elaborando)`);
          }
          
          // 🔬 DIAGNOSTIC: Track serverContent type and timestamp
          if (response.serverContent) {
            lastServerContentTimestamp = Date.now();
            lastActivityTimestamp = Date.now();
            
            // Determine content type for diagnostics
            if (response.serverContent.modelTurn?.parts?.some((p: any) => p.inlineData)) {
              lastServerContentType = 'audio';
            } else if (response.serverContent.modelTurn?.parts?.some((p: any) => p.text)) {
              lastServerContentType = 'text';
            } else {
              lastServerContentType = 'metadata';
            }
          }
          
          // 🛑 BARGE-IN FIX: Check serverContent.interrupted FIRST (before processing parts)
          // This is a server-level interruption signal from Gemini VAD
          if (response.serverContent?.interrupted) {
            const interruptTimestamp = new Date().toISOString();
            
            console.log(`\n🛑 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🛑 [${connectionId}] BARGE-IN: serverContent.interrupted detected`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`⏰ Timestamp: ${interruptTimestamp}`);
            console.log(`🎤 AI was speaking: ${isAiSpeaking ? 'YES' : 'NO'}`);
            console.log(`🎯 Action: Stop audio playback immediately`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            if (voiceProtectFirstMessage && !firstAiTurnComplete) {
              console.log(`🛡️ [${connectionId}] BARGE-IN SUPPRESSED (protect first message active)`);
            } else if (isAiSpeaking) {
              isAiSpeaking = false;
              console.log(`🔇 [${connectionId}] AI stopped speaking (serverContent.interrupted)`);
              
              clientWs.send(JSON.stringify({
                type: 'barge_in_detected',
                message: 'User interrupted - stop audio playback immediately',
                source: 'serverContent.interrupted'
              }));
            } else {
              console.log(`🔇 [${connectionId}] serverContent.interrupted received but AI was NOT speaking - ignoring (false positive)`);
            }
            
            // Note: We don't return/continue here because the subsequent code
            // has its own checks (modelTurn?.parts) which won't match if interrupted
          }
          
          // Audio output da Gemini
          if (response.serverContent?.modelTurn?.parts) {
            // ⏱️ TURN LATENCY: Track first Gemini response after user turn
            // Fallback: use lastInputTranscriptionTime when isFinal never arrives (phone calls)
            if (turnFirstGeminiResponseTime === 0 && (userFinishedSpeakingTime > 0 || lastInputTranscriptionTime > 0)) {
              if (userFinishedSpeakingTime === 0 && lastInputTranscriptionTime > 0) {
                userFinishedSpeakingTime = lastInputTranscriptionTime;
                turnLatencyMeasured = false;
                turnCount++;
                turnsInCurrentSegment++;
              }
              turnFirstGeminiResponseTime = Date.now();
            }
            
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
                console.log(`🎯 VAD Config: start=${voiceVadStartSensitivity}, end=${voiceVadEndSensitivity}, silence=${voiceVadSilenceMs}ms`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                
                if (voiceProtectFirstMessage && !firstAiTurnComplete) {
                  console.log(`🛡️ [${connectionId}] BARGE-IN (part) SUPPRESSED (protect first message active)`);
                  continue;
                }
                
                if (isAiSpeaking) {
                  isAiSpeaking = false;
                  console.log(`🔇 [${connectionId}] AI stopped speaking (user barge-in)`);
                }
                
                clientWs.send(JSON.stringify({
                  type: 'barge_in_detected',
                  message: 'User interrupted - stop audio playback immediately'
                }));
                
                continue;
              }
              
              if (part.inlineData?.data) {
                // 🔇 POST-RESUME SILENCE: Block AI audio output until user speaks after resume
                // This prevents AI from "inventing" things when WebSocket reconnects
                if (suppressAiOutputAfterResume) {
                  aiOutputBuffered++;
                  // Log only first few blocked chunks to avoid log spam
                  if (aiOutputBuffered <= 3) {
                    console.log(`🔇 [${connectionId}] POST-RESUME: Blocking AI audio chunk #${aiOutputBuffered} (waiting for user to speak)`);
                  } else if (aiOutputBuffered === 10) {
                    console.log(`🔇 [${connectionId}] POST-RESUME: Still blocking AI audio... (${aiOutputBuffered} chunks blocked so far)`);
                  }
                  continue; // Skip sending audio to client
                }
                
                // 🔒 Track AI speaking (audio streaming) - MANTIENI true su OGNI chunk
                if (!isAiSpeaking) {
                  isAiSpeaking = true;
                  if (latencyTracker.firstAudioByteTime === 0) {
                    latencyTracker.firstAudioByteTime = Date.now();

                    const total = latencyTracker.firstAudioByteTime - latencyTracker.wsArrivalTime;

                    console.log(`\n⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`⏱️ [LATENCY REPORT] FIRST AUDIO BYTE - ${connectionId}`);
                    console.log(`⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── STEP A: AUTH ─────────────────────────────────────────────────────────────┐`);
                    console.log(`⏱️  │  A. WS arrival → Auth done:           ${String(latencyTracker.authDoneTime - latencyTracker.wsArrivalTime).padStart(6)}ms                              │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── STEP B: DATA LOAD + PROMPT BUILD ─────────────────────────────────────────┐`);
                    console.log(`⏱️  │  B. Auth → Data load complete:        ${String(latencyTracker.dataLoadDoneTime - latencyTracker.authDoneTime).padStart(6)}ms                              │`);

                    if (latencyTracker.isNonClientCall) {
                      const _authToParallelGap = latencyTracker.ncParallelQueriesStartTime > 0 ? latencyTracker.ncParallelQueriesStartTime - latencyTracker.authDoneTime : 0;
                      console.log(`⏱️  │  ├── Auth → parallel queries:         ${String(_authToParallelGap).padStart(6)}ms (setup overhead)                   │`);
                      if (latencyTracker.ncConsultantInfoResolvedTime > 0) {
                        console.log(`⏱️  │  ├── consultantInfo resolved:         ${String(latencyTracker.ncConsultantInfoResolvedTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms                              │`);
                      }
                      if (latencyTracker.ncProactiveLeadResolvedTime > 0) {
                        console.log(`⏱️  │  ├── proactiveLead resolved:          ${String(latencyTracker.ncProactiveLeadResolvedTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms                              │`);
                      }
                      if (latencyTracker.ncSettingsResolvedTime > 0) {
                        console.log(`⏱️  │  ├── settings resolved:               ${String(latencyTracker.ncSettingsResolvedTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms                              │`);
                      }
                      if (latencyTracker.ncPreviousConversationsResolvedTime > 0) {
                        console.log(`⏱️  │  ├── previousConversations resolved:  ${String(latencyTracker.ncPreviousConversationsResolvedTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms (${latencyTracker.previousConversationsDbRows} DB rows → ${latencyTracker.previousConversationsCount} included) │`);
                      }
                      if (latencyTracker.ncBrandVoiceResolvedTime > 0) {
                        console.log(`⏱️  │  ├── brandVoice resolved:             ${String(latencyTracker.ncBrandVoiceResolvedTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms (${latencyTracker.brandVoiceChars} chars)                │`);
                      }
                      if (latencyTracker.ncPromptBuildDoneTime > 0) {
                        console.log(`⏱️  │  ├── prompt build done:               ${String(latencyTracker.ncPromptBuildDoneTime - latencyTracker.ncParallelQueriesStartTime).padStart(6)}ms                              │`);
                        const _promptToDataLoadGap = latencyTracker.dataLoadDoneTime - latencyTracker.ncPromptBuildDoneTime;
                        console.log(`⏱️  │  └── promptBuild → dataLoad gap:     ${String(_promptToDataLoadGap).padStart(6)}ms (logging overhead)                │`);
                      }
                    }

                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── STEP C: GEMINI WS CONNECT ────────────────────────────────────────────────┐`);
                    console.log(`⏱️  │  C. Data load → Gemini WS open:       ${String(latencyTracker.geminiOpenTime - latencyTracker.dataLoadDoneTime).padStart(6)}ms                              │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── STEP D: SETUP MESSAGE ────────────────────────────────────────────────────┐`);
                    console.log(`⏱️  │  D. Gemini WS open → Setup sent:      ${String(latencyTracker.setupSentTime - latencyTracker.geminiOpenTime).padStart(6)}ms                              │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── STEP E: GEMINI SETUP PROCESSING ──────────────────────────────────────────┐`);
                    console.log(`⏱️  │  E. Setup sent → setupComplete:       ${String(latencyTracker.setupCompleteTime - latencyTracker.setupSentTime).padStart(6)}ms                              │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️`);

                    if (latencyTracker.greetingTriggered) {
                      console.log(`⏱️  ┌─── STEP F: CHUNKS + GREETING TRIGGER ──────────────────────────────────────┐`);
                      if (latencyTracker.chunksSendStartTime > 0 && latencyTracker.chunksSendEndTime > 0) {
                        console.log(`⏱️  │  F1. setupComplete → chunks start:    ${String(latencyTracker.chunksSendStartTime - latencyTracker.setupCompleteTime).padStart(6)}ms                              │`);
                        console.log(`⏱️  │  F2. chunks sending (${String(latencyTracker.chunksCount).padStart(3)} chunks):    ${String(latencyTracker.chunksSendEndTime - latencyTracker.chunksSendStartTime).padStart(6)}ms                              │`);
                        console.log(`⏱️  │  F3. chunks end → greeting trigger:   ${String(latencyTracker.greetingTriggerTime - latencyTracker.chunksSendEndTime).padStart(6)}ms                              │`);
                      } else {
                        console.log(`⏱️  │  F. setupComplete → Greeting trigger: ${String(latencyTracker.greetingTriggerTime - latencyTracker.setupCompleteTime).padStart(6)}ms (no chunks)                    │`);
                      }
                      console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                      console.log(`⏱️`);
                      console.log(`⏱️  ┌─── STEP G: GEMINI THINKING + AUDIO GENERATION ──────────────────────────────┐`);
                      console.log(`⏱️  │  G. Greeting → First audio byte:     ${String(latencyTracker.firstAudioByteTime - latencyTracker.greetingTriggerTime).padStart(6)}ms ← GEMINI PROCESSING             │`);
                      if (latencyTracker.geminiFirstResponseTime > 0) {
                        console.log(`⏱️  │  ├── G1. Greeting → first response:   ${String(latencyTracker.geminiFirstResponseTime - latencyTracker.greetingTriggerTime).padStart(6)}ms (type: ${latencyTracker.geminiFirstResponseType.padEnd(20)})  │`);
                        console.log(`⏱️  │  └── G2. First response → first audio:${String(latencyTracker.firstAudioByteTime - latencyTracker.geminiFirstResponseTime).padStart(6)}ms                              │`);
                      }
                      console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    } else {
                      console.log(`⏱️  ┌─── STEP F: FIRST AUDIO ────────────────────────────────────────────────────┐`);
                      console.log(`⏱️  │  F. setupComplete → First audio:      ${String(latencyTracker.firstAudioByteTime - latencyTracker.setupCompleteTime).padStart(6)}ms                              │`);
                      console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    }

                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── CONTEXT SIZE BREAKDOWN ───────────────────────────────────────────────────┐`);
                    console.log(`⏱️  │  📝 System Instruction:               ${String(latencyTracker.systemInstructionChars).padStart(6)} chars (~${String(latencyTracker.systemInstructionTokens).padStart(5)} tok)      │`);
                    if (latencyTracker.isNonClientCall) {
                      console.log(`⏱️  │  ├── Voice Directives:                ${String(latencyTracker.voiceDirectivesChars).padStart(6)} chars                              │`);
                      console.log(`⏱️  │  ├── Content Prompt:                  ${String(latencyTracker.contentPromptChars).padStart(6)} chars                              │`);
                      console.log(`⏱️  │  ├── Brand Voice:                     ${String(latencyTracker.brandVoiceChars).padStart(6)} chars                              │`);
                      console.log(`⏱️  │  └── Call History:                     ${String(latencyTracker.previousCallContextChars).padStart(6)} chars (${latencyTracker.previousConversationsCount} convs)          │`);
                    }
                    console.log(`⏱️  │  📦 Chunks (user data):               ${String(latencyTracker.totalContextChars - latencyTracker.systemInstructionChars).padStart(6)} chars                              │`);
                    console.log(`⏱️  │  ═══════════════════════════════════════════                              │`);
                    console.log(`⏱️  │  📊 TOTAL CONTEXT:                     ${String(latencyTracker.totalContextChars).padStart(6)} chars (~${String(latencyTracker.totalContextTokens).padStart(5)} tok)      │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);

                    if (latencyTracker.isNonClientCall) {
                      console.log(`⏱️`);
                      console.log(`⏱️  ┌─── CALL METADATA ──────────────────────────────────────────────────────────┐`);
                      console.log(`⏱️  │  📞 Type: Non-Client ${latencyTracker.callDirection.padEnd(10)}                                            │`);
                      console.log(`⏱️  │  📋 Has Instruction: ${latencyTracker.hasInstruction ? 'YES' : 'NO '}                                                   │`);
                      console.log(`⏱️  │  📜 Has Call History: ${latencyTracker.hasCallHistory ? 'YES' : 'NO '}                                                   │`);
                      console.log(`⏱️  │  🎯 Prompt Source: ${latencyTracker.promptSource.padEnd(12)}                                              │`);
                      console.log(`⏱️  │  📞 Previous Conversations: ${String(latencyTracker.previousConversationsCount).padStart(3)} (${String(latencyTracker.previousConversationsDbRows).padStart(3)} DB rows)                       │`);
                      console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    }

                    console.log(`⏱️`);
                    console.log(`⏱️  ┌─── SUMMARY ──────────────────────────────────────────────────────────────────┐`);
                    console.log(`⏱️  │  🏁 TOTAL: WS arrival → First audio:  ${String(total).padStart(6)}ms (${(total / 1000).toFixed(1)}s)                       │`);
                    console.log(`⏱️  │  ─────────────────────────────────────────                                   │`);
                    console.log(`⏱️  │  Auth:           ${String(latencyTracker.authDoneTime - latencyTracker.wsArrivalTime).padStart(6)}ms  (${((latencyTracker.authDoneTime - latencyTracker.wsArrivalTime) / total * 100).toFixed(0).padStart(3)}%)                                  │`);
                    console.log(`⏱️  │  Data/Prompt:    ${String(latencyTracker.dataLoadDoneTime - latencyTracker.authDoneTime).padStart(6)}ms  (${((latencyTracker.dataLoadDoneTime - latencyTracker.authDoneTime) / total * 100).toFixed(0).padStart(3)}%)                                  │`);
                    console.log(`⏱️  │  Gemini connect: ${String(latencyTracker.geminiOpenTime - latencyTracker.dataLoadDoneTime).padStart(6)}ms  (${((latencyTracker.geminiOpenTime - latencyTracker.dataLoadDoneTime) / total * 100).toFixed(0).padStart(3)}%)                                  │`);
                    console.log(`⏱️  │  Gemini proc:    ${String(latencyTracker.firstAudioByteTime - latencyTracker.geminiOpenTime).padStart(6)}ms  (${((latencyTracker.firstAudioByteTime - latencyTracker.geminiOpenTime) / total * 100).toFixed(0).padStart(3)}%)                                  │`);
                    console.log(`⏱️  └──────────────────────────────────────────────────────────────────────────────┘`);
                    console.log(`⏱️ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                  }
                  console.log(`🎤 [${connectionId}] AI started speaking (audio streaming)`);
                  
                  // ⏱️ PER-TURN LATENCY: Measure time from user finished speaking to AI first audio
                  if (userFinishedSpeakingTime > 0 && !turnLatencyMeasured) {
                    turnLatencyMeasured = true;
                    const now = Date.now();
                    const totalTurnLatencyMs = now - userFinishedSpeakingTime;
                    const serverProcessing = turnWatchdogStartedTime > 0 ? turnWatchdogStartedTime - userFinishedSpeakingTime : 0;
                    const geminiThinking = turnWatchdogStartedTime > 0 ? now - turnWatchdogStartedTime : totalTurnLatencyMs;
                    
                    const vadSilenceConfig = voiceVadSilenceMs;
                    const downstreamEstimate = 250;
                    const upstreamVpsToReplit = 100;
                    const fullPerceivedMs = vadSilenceConfig + totalTurnLatencyMs + downstreamEstimate;
                    const vadToTranscript = isPhoneCall && lastPhoneAudioReceivedTime > 0 ? Math.max(0, userFinishedSpeakingTime - lastPhoneAudioReceivedTime) : 0;
                    
                    console.log(`\n⏱️ ┌─── FULL LATENCY CHAIN #${turnCount} ──────────────────────────────────────┐`);
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  ☎️  UPSTREAM (User voice → Gemini)                            │`);
                    console.log(`⏱️ │    Phone→FreeSWITCH→VPS:        ~fixed (SIP)                   │`);
                    console.log(`⏱️ │    VPS resample (8→16kHz):       ~2ms                          │`);
                    console.log(`⏱️ │    VPS→Replit (network):       ~${String(upstreamVpsToReplit).padStart(3)}ms                         │`);
                    console.log(`⏱️ │    Gemini VAD silence wait:    ${String(vadSilenceConfig).padStart(4)}ms ← HIDDEN COST             │`);
                    if (vadToTranscript > 0) {
                      console.log(`⏱️ │    VAD actual (audio→isFinal): ${String(vadToTranscript).padStart(4)}ms (measured)               │`);
                    }
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  🖥️  SERVER PROCESSING                                        │`);
                    console.log(`⏱️ │    Feedback+commit+watchdog:   ${String(serverProcessing).padStart(4)}ms                          │`);
                    if (turnFeedbackInjectedTime > 0) {
                      const fbMs = turnFeedbackInjectedTime - userFinishedSpeakingTime;
                      console.log(`⏱️ │      └─ feedback inject:      ${String(fbMs).padStart(4)}ms                          │`);
                    }
                    if (turnCommitDoneTime > 0) {
                      const cmMs = turnCommitDoneTime - (turnFeedbackInjectedTime || userFinishedSpeakingTime);
                      console.log(`⏱️ │      └─ commit:               ${String(cmMs).padStart(4)}ms                          │`);
                    }
                    console.log(`⏱️ │    salesTracker:               async (non-blocking)            │`);
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  🤖 GEMINI THINKING                                           │`);
                    console.log(`⏱️ │    AI processing:             ${String(geminiThinking).padStart(4)}ms (${(geminiThinking / 1000).toFixed(1)}s)                   │`);
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  📡 DOWNSTREAM (Gemini → Phone)                               │`);
                    console.log(`⏱️ │    Replit→VPS (network):       ~${String(upstreamVpsToReplit).padStart(3)}ms                         │`);
                    console.log(`⏱️ │    VPS resample (24→8kHz):      ~2ms                          │`);
                    console.log(`⏱️ │    VPS queue+prefill:           ~40ms                          │`);
                    console.log(`⏱️ │    VPS→FreeSWITCH→Phone:      ~${String(downstreamEstimate - 40 - upstreamVpsToReplit).padStart(3)}ms (SIP/RTP)                  │`);
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │`);
                    console.log(`⏱️ │  📊 MEASURED (isFinal→1st audio):  ${String(totalTurnLatencyMs).padStart(5)}ms (${(totalTurnLatencyMs / 1000).toFixed(1)}s)              │`);
                    console.log(`⏱️ │     └─ server: ${String(serverProcessing).padStart(4)}ms + gemini: ${String(geminiThinking).padStart(4)}ms                    │`);
                    console.log(`⏱️ │                                                                │`);
                    const perceivedSec = (fullPerceivedMs / 1000).toFixed(1);
                    const perceivedIcon = fullPerceivedMs > 3000 ? '⚠️ SLOW' : fullPerceivedMs > 2000 ? '⚡' : '✅';
                    console.log(`⏱️ │  🎯 FULL PERCEIVED (user ears):   ${String(fullPerceivedMs).padStart(5)}ms (${perceivedSec}s) ${perceivedIcon}     │`);
                    console.log(`⏱️ │     = VAD(${vadSilenceConfig}) + measured(${totalTurnLatencyMs}) + downstream(${downstreamEstimate})        │`);
                    console.log(`⏱️ │                                                                │`);
                    console.log(`⏱️ │  ⚙️  CONFIG: vadSilence=${vadSilenceConfig}ms endSens=${voiceVadEndSensitivity}  │`);
                    console.log(`⏱️ └────────────────────────────────────────────────────────────────┘\n`);
                  }
                } else {
                  // Assicurati che rimanga true durante tutto lo streaming
                  isAiSpeaking = true;
                }
                
                // PCM 24kHz raw da Gemini
                const pcmBuffer = base64ToBuffer(part.inlineData.data);
                
                if (isPhoneCall) {
                  // PHONE CALL: Invia PCM raw binario direttamente al VPS (24kHz)
                  clientWs.send(pcmBuffer, { binary: true });
                  
                  // ⏱️ Track first audio sent to phone for E2E latency
                  if (firstAudioSentToPhoneTime === 0) {
                    firstAudioSentToPhoneTime = Date.now();
                  }
                  
                  // Log solo ogni 10 chunk per non spammare
                  if (Math.random() < 0.1) {
                    console.log(`📞 [${connectionId}] Phone audio: ${pcmBuffer.length} bytes PCM raw → VPS`);
                  }
                } else {
                  // BROWSER: Converti in WAV e invia come JSON base64
                  const wavBuffer = await convertPCMToWAV(pcmBuffer, 24000);
                  clientWs.send(JSON.stringify({
                    type: 'audio_output',
                    data: bufferToBase64(wavBuffer)
                  }));
                }
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
            
            // 🔧 FIX WATCHDOG: Gemini ha iniziato a rispondere! Cancella il watchdog
            if (userMessagePendingResponse) {
              cancelResponseWatchdog();
            }
            
            // Accumula per tracciamento server-side
            currentAiTranscript += transcriptText;
            currentAiSpokenText += transcriptText; // ONLY actual spoken words (no thinking)
            
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
            
            // 🔬 DIAGNOSTIC: Track when user starts speaking (for backup watchdog)
            if (userSpeakingStartTime === null) {
              userSpeakingStartTime = Date.now();
              console.log(`🎙️ [${connectionId}] User started speaking - backup watchdog armed`);
            }
            lastActivityTimestamp = Date.now();
            
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
              
              // 🔇 POST-RESUME SILENCE: User spoke, disable silence mode
              if (suppressAiOutputAfterResume) {
                console.log(`\n🔊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`🔊 [${connectionId}] POST-RESUME SILENCE ENDED - User spoke!`);
                console.log(`   → User transcript: "${userTranscriptText}"`);
                console.log(`   → AI output is now ENABLED`);
                console.log(`🔊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                suppressAiOutputAfterResume = false;
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
                  
                  // 🔧 FIX: List of common Italian short words that are COMPLETE words (not fragments)
                  // These should ALWAYS be followed by a space, not joined with next word
                  // Example: "Che" + "cosa" should be "Che cosa", not "Checosa"
                  const italianCompleteWords = new Set([
                    // Pronouns and articles
                    'che', 'chi', 'cosa', 'come', 'dove', 'quando', 'perché', 'perche',
                    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
                    // Conjunctions and prepositions  
                    'e', 'o', 'ma', 'se', 'di', 'da', 'in', 'su', 'per', 'con', 'tra', 'fra',
                    'a', 'al', 'ai', 'del', 'dei', 'nel', 'nei', 'sul', 'sui',
                    // Common short verbs/words
                    'è', 'ho', 'ha', 'so', 'sa', 'va', 'fa', 'può', 'puo', 'vuoi', 'vuole',
                    'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mi', 'ti', 'ci', 'vi', 'si',
                    'non', 'già', 'gia', 'ora', 'poi', 'qui', 'là', 'la', 'lì', 'li',
                    // Common interjections
                    'ah', 'oh', 'eh', 'ok', 'sì', 'si', 'no', 'beh', 'boh', 'mah',
                    // Demonstratives
                    'questo', 'questa', 'quello', 'quella', 'questi', 'queste', 'quelli', 'quelle'
                  ]);
                  
                  // Check if buffer is a complete Italian word (should be followed by space)
                  const bufferWord = vadConcatBuffer.toLowerCase().trim();
                  const isBufferCompleteWord = italianCompleteWords.has(bufferWord);
                  
                  // Join WITHOUT space only if:
                  // - Buffer does NOT end with sentence punctuation
                  // - Buffer ends with a letter (partial word)
                  // - Chunk starts with lowercase letter (continuation of word)
                  // - Buffer is NOT a complete Italian word (new check!)
                  const isPartialWord = !bufferEndsSentence && 
                                        !isBufferCompleteWord &&  // 🔧 FIX: Don't join if buffer is complete word
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
                    if (isBufferCompleteWord) {
                      console.log(`📝 [VAD CONCAT] Italian word + new phrase: "${vadConcatBuffer}" + "${userTranscriptText}" = "${processedTranscript}"`);
                    } else {
                      console.log(`📝 [VAD CONCAT] New phrase: "${vadConcatBuffer}" + "${userTranscriptText}" = "${processedTranscript}"`);
                    }
                  }
                }
              }
              
              // Update buffer and timestamp
              vadConcatBuffer = processedTranscript;
              vadLastChunkTime = now;
              lastInputTranscriptionTime = now;
              
              currentUserTranscript = processedTranscript;
              
              // 🎯 SALES SCRIPT TRACKING - Buffer user transcript until isFinal
              pendingUserTranscript.text = processedTranscript;
              
              if (isFinal) {
                pendingUserTranscript.hasFinalChunk = true;
                const finalTranscript = processedTranscript; // Use concatenated version
                
                // 🔬 DIAGNOSTIC: Mark isFinal received for this turn
                isFinalReceivedForCurrentTurn = true;
                userSpeakingStartTime = null; // Reset - user finished speaking
                userFinishedSpeakingTime = Date.now(); // ⏱️ TURN LATENCY: mark when user stopped
                turnLatencyMeasured = false; // Reset for this turn
                turnSalesTrackerDoneTime = 0;
                turnFeedbackInjectedTime = 0;
                turnCommitDoneTime = 0;
                turnWatchdogStartedTime = 0;
                turnFirstGeminiResponseTime = 0;
                turnCount++;
                turnsInCurrentSegment++;
                console.log(`✅ [${connectionId}] isFinal received - user finished speaking (turn #${turnCount}, segment turn #${turnsInCurrentSegment})`);
                
                // Reset VAD buffer on final
                vadConcatBuffer = '';
                vadLastChunkTime = 0;
                
                {
                  if (pendingFeedbackForAI && geminiSession) {
                    console.log(`\n📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`📤 [${connectionId}] PIGGYBACK INJECTION - Sending feedback to Gemini`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`   👤 User said: "${finalTranscript.substring(0, 80)}${finalTranscript.length > 80 ? '...' : ''}"`);
                    console.log(`   📝 Injecting: "${pendingFeedbackForAI.substring(0, 100)}..."`);
                    console.log(`   🎯 Strategy: Inject AFTER audio, BEFORE response (Trojan Horse)`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                    
                    const feedbackPayload = {
                      clientContent: {
                        turns: [{
                          role: 'user',
                          parts: [{ text: pendingFeedbackForAI }]
                        }],
                        turnComplete: false
                      }
                    };
                    geminiSession.send(JSON.stringify(feedbackPayload));
                    
                    const combinedMessage = finalTranscript + '\n\n' + pendingFeedbackForAI;
                    commitUserMessage(combinedMessage);
                    
                    pendingFeedbackForAI = null;
                    turnFeedbackInjectedTime = Date.now();
                    
                    if (conversationId) {
                      db.update(clientSalesConversations)
                        .set({ pendingFeedback: null, pendingFeedbackCreatedAt: null })
                        .where(eq(clientSalesConversations.id, conversationId))
                        .then(() => console.log(`   💾 Feedback cleared from DB after injection`))
                        .catch((err: any) => console.error(`   ⚠️ Failed to clear feedback from DB: ${err.message}`));
                    }
                  } else {
                    commitUserMessage(finalTranscript);
                  }
                  turnCommitDoneTime = Date.now();
                  
                  pendingUserTranscript = { text: '', hasFinalChunk: false };
                  
                  if (geminiSession) {
                    startResponseWatchdog(finalTranscript, geminiSession);
                  }
                  turnWatchdogStartedTime = Date.now();
                  
                  const serverProcessingMs = turnWatchdogStartedTime - userFinishedSpeakingTime;
                  console.log(`⏱️ [TURN LATENCY] Turn #${turnCount} server processing: ${serverProcessingMs}ms (feedback+commit+watchdog, NON-BLOCKING)`);
                  if (turnFeedbackInjectedTime > 0) {
                    console.log(`   └─ feedbackInjection: ${turnFeedbackInjectedTime - userFinishedSpeakingTime}ms`);
                  }
                  console.log(`   └─ commit+watchdog: ${turnWatchdogStartedTime - turnCommitDoneTime}ms`);
                  
                  if (isProspectQuestion(finalTranscript)) {
                    lastProspectQuestion = finalTranscript;
                    console.log(`🤖➡️😊 [${connectionId}] PROSPECT QUESTION DETECTED: "${finalTranscript.substring(0, 80)}..."`);
                  }
                  
                  if (salesTracker && salesLogger) {
                    const salesTrackStart = Date.now();
                    (async () => {
                      try {
                        await salesTracker.trackUserMessage(finalTranscript);
                        const state = salesTracker.getState();
                        salesLogger.logUserMessage(finalTranscript, state.currentPhase);
                        
                        const lastLadder = state.ladderActivations[state.ladderActivations.length - 1];
                        if (lastLadder && salesLogger) {
                          salesLogger.logLadderResponse(lastLadder.wasVague, lastLadder.wasVague);
                        }
                        
                        turnSalesTrackerDoneTime = Date.now();
                        console.log(`⏱️ [SALES-TRACKER] Completed in ${turnSalesTrackerDoneTime - salesTrackStart}ms (non-blocking, did NOT delay AI response)`);
                      } catch (trackError: any) {
                        console.error(`❌ [${connectionId}] Sales tracking error (non-blocking):`, trackError.message);
                      }
                    })();
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
              
              if (voiceProtectFirstMessage && !firstAiTurnComplete) {
                console.log(`🛡️ [${connectionId}] stop_audio SUPPRESSED (protect first message active)`);
              } else if (isAiSpeaking) {
                console.log(`🛑 [${connectionId}] BARGE-IN ATTIVATO - Invio stop_audio al client`);
                clientWs.send(JSON.stringify({
                  type: 'stop_audio',
                  reason: 'user_speaking',
                  message: 'User is speaking - stop AI audio immediately'
                }));
                
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
              
              // 🔧 FIX: NON avviare watchdog nel fallback path!
              // Quando turnComplete arriva, significa che l'AI HA GIÀ RISPOSTO.
              // Avviare il watchdog qui causa retry inutili perché aspetta una risposta
              // che non arriverà mai (Gemini ha già completato il turno).
              // Il fallback serve SOLO per salvare il messaggio utente, non per aspettare risposta.
              console.log(`📝 [${connectionId}] Fallback: User message saved, NO watchdog needed (AI already responded)`);
              
              pendingUserTranscript = { text: '', hasFinalChunk: false }; // Reset
            }
            
            // ⏱️ Reset turn latency tracking for next turn
            userFinishedSpeakingTime = 0;
            lastInputTranscriptionTime = 0;
            turnFirstGeminiResponseTime = 0;
            firstAudioSentToPhoneTime = 0;
            
            // 🔒 AI has finished speaking
            const wasAiSpeaking = isAiSpeaking;
            isAiSpeaking = false;
            lastAiTurnCompleteTimestamp = Date.now();
            if (wasAiSpeaking) {
              console.log(`🔇 [${connectionId}] AI finished speaking (turn complete)`);
            }

            if (!firstAiTurnComplete) {
              firstAiTurnComplete = true;
              console.log(`🎙️ [${connectionId}] First AI turn complete (thinkingBudget=${voiceThinkingBudget} for entire session)`);
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
              // 🎯 USE SPOKEN TEXT ONLY for saving to DB (strips thinking/reasoning)
              const spokenOnly = currentAiSpokenText.trim() || trimmedTranscript; // Fallback to full if no outputTranscription
              
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
                transcript: spokenOnly,
                duration: 0, // Calcolato dal client
                timestamp: new Date().toISOString()
              });
              if (spokenOnly !== trimmedTranscript) {
                console.log(`🧹 [${connectionId}] Stripped thinking from AI message: ${trimmedTranscript.length} chars → ${spokenOnly.length} chars (spoken only)`);
              }
              console.log(`💾 [${connectionId}] Saved AI message (server-side): ${conversationMessages.length} total messages`);
              
              // 📞 Update voice call transcript in real-time
              scheduleTranscriptUpdate();

              const hasNewUserInput = lastUserMessageIndex > lastSupervisorUserIndex;
              if (!hasNewUserInput) {
                console.log(`⏭️  [${connectionId}] Supervisors SKIPPED - no new user input since last analysis (lastUserIdx: ${lastUserMessageIndex}, lastSupervisorIdx: ${lastSupervisorUserIndex})`);
              }

              const taskSupervisorActive = taskSupervisor && ['raccolta_dati', 'dati_completi', 'confermato'].includes(taskSupervisor.getState().stage);
              if (bookingSupervisor && isPhoneCall && hasNewUserInput) {
                (async () => {
                  try {
                    const { client: aiClient, cleanup, setFeature } = await getAIProvider(consultantId!, consultantId!);
                    setFeature?.('voice-call');
                    try {
                      const bookingMessages: BookingMessage[] = conversationMessages
                        .filter(m => !m.transcript.includes('[SYSTEM_INSTRUCTION') && !m.transcript.includes('[TASK_CREATED]') && !m.transcript.includes('[TASK_MODIFIED]') && !m.transcript.includes('[TASK_CANCELLED]') && !m.transcript.includes('[BOOKING_CREATED]') && !m.transcript.includes('[BOOKING_FAILED]') && !m.transcript.includes('[TASK_NOT_FOUND]') && !m.transcript.includes('[TASK_LIST]'))
                        .map(m => ({
                        role: m.role,
                        transcript: m.transcript,
                        timestamp: m.timestamp,
                      }));
                      const result = await bookingSupervisor!.analyzeTranscript(bookingMessages, aiClient);
                      
                      if (result.action === 'booking_created' && result.notifyMessage) {
                        console.log(`\n📅 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`📅 [${connectionId}] BOOKING CONFIRMED! Injecting notification to Gemini`);
                        console.log(`📅   Booking ID: ${result.bookingId}`);
                        console.log(`📅   Type: ${result.bookingType}`);
                        console.log(`📅   Meet Link: ${result.googleMeetLink || 'N/A'}`);
                        console.log(`📅 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        
                        if (geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
                          const bookingNotification = {
                            clientContent: {
                              turns: [{
                                role: 'user',
                                parts: [{ text: result.notifyMessage }]
                              }],
                              turnComplete: true
                            }
                          };
                          geminiSession.send(JSON.stringify(bookingNotification));
                          console.log(`📅 [${connectionId}] Booking confirmation injected to Gemini Live`);
                        }
                      } else if (result.action === 'booking_failed' && result.errorMessage) {
                        console.log(`❌ [${connectionId}] Booking failed: ${result.errorMessage}`);
                        if (geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
                          const errorNotification = {
                            clientContent: {
                              turns: [{
                                role: 'user',
                                parts: [{ text: `[BOOKING_FAILED] Errore nella prenotazione: ${result.errorMessage}. Comunica al chiamante che c'è stato un problema e proponi di riprovare con un altro orario.` }]
                              }],
                              turnComplete: true
                            }
                          };
                          geminiSession.send(JSON.stringify(errorNotification));
                        }
                      }
                    } finally {
                      if (cleanup) cleanup();
                    }
                  } catch (bookingErr: any) {
                    console.error(`❌ [${connectionId}] Booking supervisor error:`, bookingErr.message);
                  }
                })();
              }

              if (taskSupervisor && isPhoneCall && hasNewUserInput) {
                (async () => {
                  try {
                    const { client: aiClient, cleanup, setFeature } = await getAIProvider(consultantId!, consultantId!);
                    setFeature?.('voice-call');
                    try {
                      const taskMessages: TaskConversationMessage[] = conversationMessages
                        .filter(m => !m.transcript.includes('[SYSTEM_INSTRUCTION') && !m.transcript.includes('[TASK_CREATED]') && !m.transcript.includes('[TASK_MODIFIED]') && !m.transcript.includes('[TASK_CANCELLED]') && !m.transcript.includes('[BOOKING_CREATED]') && !m.transcript.includes('[BOOKING_FAILED]') && !m.transcript.includes('[TASK_NOT_FOUND]') && !m.transcript.includes('[TASK_LIST]'))
                        .map(m => ({
                        role: m.role,
                        transcript: m.transcript,
                        timestamp: m.timestamp,
                      }));
                      const result = await taskSupervisor!.analyzeTranscript(taskMessages, aiClient);

                      if (result.notifyMessage && geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
                        if (result.action === 'tasks_created') {
                          console.log(`\n📝 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                          console.log(`📝 [${connectionId}] TASK CREATED! Injecting notification to Gemini`);
                          console.log(`📝   Task IDs: ${result.createdTaskIds?.join(', ')}`);
                          if (result.conflictWarning) {
                            console.log(`⚠️   Conflict: ${result.conflictWarning}`);
                          }
                          console.log(`📝 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        } else if (result.action === 'task_modified') {
                          console.log(`📝 [${connectionId}] Task modified: ${result.modifiedTaskId}`);
                        } else if (result.action === 'task_cancelled') {
                          console.log(`📝 [${connectionId}] Task cancelled: ${result.cancelledTaskId}`);
                        } else if (result.action === 'tasks_listed') {
                          console.log(`📝 [${connectionId}] Task list sent to Gemini`);
                        } else if (result.action === 'task_failed') {
                          console.log(`❌ [${connectionId}] Task operation failed: ${result.errorMessage}`);
                        }

                        const taskNotification = {
                          clientContent: {
                            turns: [{
                              role: 'user',
                              parts: [{ text: result.notifyMessage }]
                            }],
                            turnComplete: true
                          }
                        };
                        geminiSession.send(JSON.stringify(taskNotification));
                        console.log(`📝 [${connectionId}] Task supervisor notification injected to Gemini Live`);
                      }
                    } finally {
                      if (cleanup) cleanup();
                    }
                  } catch (taskErr: any) {
                    console.error(`❌ [${connectionId}] Task supervisor error:`, taskErr.message);
                  }
                })();
              }

              const bookingSupervisorRan = bookingSupervisor && isPhoneCall && hasNewUserInput;
              const taskSupervisorRan = taskSupervisor && isPhoneCall && hasNewUserInput;
              if (bookingSupervisorRan || taskSupervisorRan) {
                lastSupervisorUserIndex = lastUserMessageIndex;
              }
              
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
                        
                        // 🆕 FIX MEMORIA: Passa TUTTI i messaggi (no slice) - il context di Gemini è ampio
                        const recentMessages = conversationMessages.map(msg => ({
                          role: msg.role as 'user' | 'assistant',
                          content: msg.transcript,
                          timestamp: msg.timestamp
                        }));
                        
                        // 🔍 DEBUG: Log esatto dei messaggi passati al SalesManagerAgent
                        console.log(`\n📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`📋 [${connectionId}] MESSAGGI PASSATI AL SALES MANAGER (${recentMessages.length} - TUTTI):`);
                        const messagesToShow = recentMessages.slice(-6);
                        const startIndex = Math.max(0, recentMessages.length - 6);
                        messagesToShow.forEach((msg, i) => {
                          const preview = msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content;
                          console.log(`   ${startIndex + i + 1}. [${msg.role.toUpperCase()}]: "${preview}"`);
                        });
                        if (recentMessages.length > 6) {
                          console.log(`   ... (+ ${recentMessages.length - 6} messaggi precedenti inclusi)`);
                        }
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        
                        // 🔍 DEBUG DETTAGLIATO: Cosa arriva dal parser?
                        console.log(`\n🔍 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                        console.log(`🔍 [DEBUG] CHECKPOINT DATA FROM PARSER:`);
                        script.phases.forEach((p, idx) => {
                          console.log(`   📍 Phase ${p.number} (${p.id}):`);
                          console.log(`      checkpoints array: ${p.checkpoints ? p.checkpoints.length : 'undefined'}`);
                          if (p.checkpoints && p.checkpoints.length > 0) {
                            p.checkpoints.forEach((cp, cpIdx) => {
                              console.log(`      └─ Checkpoint ${cpIdx + 1}:`);
                              console.log(`         id: ${cp.id || 'undefined'}`);
                              console.log(`         description: ${cp.description ? cp.description.substring(0, 50) + '...' : 'undefined'}`);
                              console.log(`         verifications: ${cp.verifications ? cp.verifications.length + ' items' : 'undefined'}`);
                              if (cp.verifications && cp.verifications.length > 0) {
                                // 🔧 FIX: Mostra TUTTE le verifiche nel log, non solo 3
                                cp.verifications.forEach((v, vIdx) => {
                                  console.log(`            ${vIdx + 1}. ${v.substring(0, 60)}...`);
                                });
                              }
                            });
                          }
                        });
                        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                        
                        // Prepare script structure for agent
                        // 🆕 FIX CRITICO: Includi il CHECKPOINT della fase per permettere la validazione
                        // NOTA: Lo script dal parser ha p.checkpoints (array) con verifications/description
                        //       Il SalesManagerAgent si aspetta checkpoint (singolo) con checks/title
                        const scriptForAgent = {
                          phases: script.phases.map(p => {
                            // Combina tutti i checkpoint della fase in uno solo (o usa il primo)
                            // Lo script originale può avere più checkpoint, ma il manager ne vuole uno
                            const firstCheckpoint = p.checkpoints && p.checkpoints.length > 0 ? p.checkpoints[0] : null;
                            
                            // Combina tutte le verifications di tutti i checkpoint in un unico array di checks
                            const allVerifications: string[] = [];
                            if (p.checkpoints && p.checkpoints.length > 0) {
                              p.checkpoints.forEach(cp => {
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
                              steps: p.steps.map(s => ({
                                id: s.id,
                                number: s.number,
                                name: s.name,
                                objective: s.objective,
                                questions: s.questions || []
                              })),
                              // 🆕 CHECKPOINT: Mappato da checkpoints[] a checkpoint singolo
                              // verifications → checks, description → title
                              checkpoint: firstCheckpoint ? {
                                id: firstCheckpoint.id || `checkpoint_${p.id}`,
                                title: firstCheckpoint.description || `Checkpoint Fase ${p.number}`,
                                checks: allVerifications.length > 0 ? allVerifications : (firstCheckpoint.verifications || [])
                              } : undefined
                            };
                          })
                        };
                        
                        // 🆕 DEBUG: Log checkpoint passati al SalesManagerAgent
                        const phasesWithCheckpoints = scriptForAgent.phases.filter(p => p.checkpoint);
                        if (phasesWithCheckpoints.length > 0) {
                          console.log(`   ⛔ Checkpoints trovati: ${phasesWithCheckpoints.length} fasi con checkpoint`);
                          phasesWithCheckpoints.forEach(p => {
                            console.log(`      - Fase ${p.number}: "${p.checkpoint?.title}" (${p.checkpoint?.checks?.length || 0} checks)`);
                          });
                        } else {
                          console.log(`   ⚠️ ATTENZIONE: Nessun checkpoint definito nello script!`);
                        }
                        
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
                          totalMessages: conversationMessages.length,
                          // 🆕 ARCHETYPE PERSISTENCE: Passa lo stato dell'archetipo dalla chiamata precedente
                          archetypeState: persistentArchetypeState as any,
                          currentTurn: conversationMessages.length,
                          // 🆕 CHECKPOINT PERSISTENCE: Passa i checkpoint già completati (verde = resta verde)
                          completedCheckpoints: state.checkpointsCompleted,
                          // 🔒 STICKY VALIDATION: Passa gli item singoli già validati (verde = resta verde)
                          validatedCheckpointItems: persistentValidatedItems
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
                        
                        // 🆕 CHECK: Disable Sales Manager for testing
                        const isSalesManagerDisabled = process.env.DISABLE_SALES_MANAGER === 'true';
                        
                        let analysis: SalesManagerAnalysis;
                        let analysisTime: number;
                        
                        if (isSalesManagerDisabled) {
                          console.log(`\n${'🔴'.repeat(45)}`);
                          console.log(`🔴 SALES MANAGER DISABLED (DISABLE_SALES_MANAGER=true)`);
                          console.log(`🔴 Skipping all analysis - Sales Agent proceeds WITHOUT coaching`);
                          console.log(`${'🔴'.repeat(45)}\n`);
                          
                          // Create empty analysis (no feedback, no advancement, no coaching)
                          analysis = {
                            stepAdvancement: {
                              shouldAdvance: false,
                              nextPhaseId: undefined,
                              nextStepId: undefined,
                              confidence: 0,
                              reasoning: 'Sales Manager disabled - no analysis'
                            },
                            buySignals: { detected: false, signals: [], confidence: 0 },
                            objections: { detected: false, objections: [], confidence: 0 },
                            toneAnalysis: { issues: [], suggestions: [], confidence: 0 },
                            checkpointValidation: { isComplete: true, missingItems: [] },
                            toneMonitoring: { issues: [], suggestions: [] },
                            prospectProfile: { current: 'unknown', confidence: 0, signals: [] },
                            feedbackForAgent: null,
                            archetypeState: persistentArchetypeState as any
                          };
                          analysisTime = 0;
                        } else {
                          console.log(`   📨 Calling SalesManagerAgent.analyze()...`);
                          const analysisStart = Date.now();
                          analysis = await SalesManagerAgent.analyze(params);
                          analysisTime = Date.now() - analysisStart;
                        }
                        
                        // 🆕 ARCHETYPE PERSISTENCE: Salva lo stato per la prossima chiamata
                        // IMPORTANTE: Deep clone per evitare mutazioni condivise tra turni
                        if (analysis.archetypeState) {
                          persistentArchetypeState = {
                            current: analysis.archetypeState.current,
                            confidence: analysis.archetypeState.confidence,
                            consecutiveSignals: analysis.archetypeState.consecutiveSignals,
                            lastUpdatedAtTurn: analysis.archetypeState.lastUpdatedAtTurn,
                            turnsSinceUpdate: analysis.archetypeState.turnsSinceUpdate,
                            lastSignalType: analysis.archetypeState.lastSignalType,
                            regexSignals: [...(analysis.archetypeState.regexSignals || [])],
                            aiIntuition: analysis.archetypeState.aiIntuition
                          };
                          console.log(`   🎭 Archetype state SAVED: ${analysis.archetypeState.current} (${(analysis.archetypeState.confidence * 100).toFixed(0)}%)`);
                        }
                        
                        // 🔒 STICKY VALIDATION: Salva i nuovi item validati per la prossima chiamata
                        // Una volta verde, resta verde - evita che l'AI "dimentichi" validazioni
                        if (analysis.checkpointStatus?.itemDetails && analysis.checkpointStatus?.checkpointId) {
                          const checkpointId = analysis.checkpointStatus.checkpointId;
                          const newValidatedItems = analysis.checkpointStatus.itemDetails.filter(
                            item => item.status === 'validated'
                          );
                          
                          // Merge: mantieni i vecchi validati, aggiungi i nuovi (senza duplicati)
                          const existingItems = persistentValidatedItems[checkpointId] || [];
                          const mergedItems = [...existingItems];
                          
                          newValidatedItems.forEach(newItem => {
                            // Aggiungi solo se non esiste già (evita duplicati)
                            if (!mergedItems.some(m => m.check === newItem.check)) {
                              mergedItems.push({
                                check: newItem.check,
                                status: newItem.status,
                                infoCollected: newItem.infoCollected,
                                evidenceQuote: newItem.evidenceQuote,
                                reason: newItem.reason
                              });
                            }
                          });
                          
                          persistentValidatedItems[checkpointId] = mergedItems;
                          
                          const newCount = mergedItems.length - existingItems.length;
                          if (newCount > 0 || existingItems.length > 0) {
                            console.log(`   🔒 STICKY VALIDATION SAVED: ${mergedItems.length} validated items for ${checkpointId}`);
                            if (newCount > 0) {
                              console.log(`      → ${newCount} NEW items added this turn`);
                            }
                          }
                          
                          // 🔒 PERSIST TO DATABASE: Aggiorna il tracker con TUTTI i mergedItems e salva subito
                          // Così gli item validati sopravvivono ai riavvii della sessione
                          if (salesTracker) {
                            // IMPORTANTE: Passa TUTTI i mergedItems (vecchi + nuovi), non solo newValidatedItems
                            // Questo garantisce che i vecchi item verdi non vengano persi
                            salesTracker.setValidatedCheckpointItems({
                              ...salesTracker.getValidatedCheckpointItems(),
                              [checkpointId]: mergedItems.map(item => ({
                                check: item.check,
                                status: item.status as 'validated' | 'missing' | 'vague',
                                infoCollected: item.infoCollected,
                                evidenceQuote: item.evidenceQuote,
                                reason: item.reason,
                                validatedAt: new Date().toISOString()
                              }))
                            });
                            // 🔒 SALVATAGGIO IMMEDIATO: Non aspettare autosave, salva subito per evitare perdita dati
                            salesTracker.forceSave().catch(err => {
                              console.error(`❌ [STICKY] Failed to save validated items to DB:`, err.message);
                            });
                          }
                        }
                        
                        // Extract step advancement from full analysis
                        const stepResult = analysis.stepAdvancement;
                        // 👇 AGGIUNGI QUESTA RIGA QUI:
                        const checkpointStatus = analysis.checkpointStatus;
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
                        
                        // 🆕 Track injected instruction for UI (declared here so it's available for analysis payload)
                        let injectedInstructionForUI: string | null = null;
                        
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
                          
                          // 🚀 FORMATO COMPATTO: Feedback DINAMICO - OBIETTIVO + TONO + COSA MANCA
                          // Ora include currentObjective per dare la LOGICA della fase
                          // 🆕 Estrai AI Intuition e Suggerimento dal checkpoint
                          const aiIntuitionText = analysis.archetypeState?.aiIntuition || null;
                          const aiSuggestionText = analysis.checkpointStatus?.itemDetails
                            ?.filter(item => item.status !== 'validated' && item.suggestedNextAction)
                            ?.map(item => item.suggestedNextAction)
                            ?.slice(0, 1)
                            ?.join(' ') || null;

                          const compactFeedback = formatCompactFeedback({
                            feedbackType,
                            feedbackPriority,
                            doingWell,
                            needsImprovement,
                            toneReminder,
                            archetypeState: analysis.archetypeState || null,
                            toneAnalysis: analysis.toneAnalysis || null,
                            stepResult: stepResult || null,
                            checkpointItemDetails: analysis.checkpointStatus?.itemDetails || null,
                            currentObjective: currentObjective || null, // 🆕 Obiettivo della fase
                            aiIntuition: aiIntuitionText, // 🆕 AI Intuition dal checkpoint
                            aiSuggestion: aiSuggestionText // 🆕 Suggerimento AI dal checkpoint
                          });
                          
                          // 🆕 Save compact feedback for UI visualization
                          injectedInstructionForUI = compactFeedback;
                          
                          const feedbackContent = `<<<SALES_MANAGER_INSTRUCTION>>>
${compactFeedback}
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
                          // 🆕 Log del feedbackContent COMPLETO per debug + TOKEN COUNT
                          // Stima token: 1 token ≈ 4 caratteri (approssimazione standard)
                          const estimatedTokens = Math.ceil(feedbackContent.length / 4);
                          console.log(`\n${'═'.repeat(90)}`);
                          console.log(`📤 SALES MANAGER → SALES AGENT: MESSAGGIO COMPLETO (${estimatedTokens} token)`);
                          console.log(`${'═'.repeat(90)}`);
                          console.log(`🎯 DECISION SUMMARY:`);
                          console.log(`   • Step Advancement: ${stepResult.shouldAdvance ? '✅ YES' : '❌ NO'}`);
                          if (stepResult.shouldAdvance) {
                            console.log(`     → Next Phase: ${stepResult.nextPhaseId}`);
                            console.log(`     → Next Step: ${stepResult.nextStepId}`);
                            console.log(`     → Confidence: ${(stepResult.confidence * 100).toFixed(0)}%`);
                          }
                          console.log(`   • Checkpoint Status: ${checkpointStatus?.isComplete ? '✅ COMPLETE' : '⛔ INCOMPLETE'}`);
                          if (checkpointStatus && !checkpointStatus.isComplete) {
                            console.log(`     → Missing: ${checkpointStatus.missingItems.slice(0, 3).join(', ')}${checkpointStatus.missingItems.length > 3 ? '...' : ''}`);
                          }
                          console.log(`   • Feedback Type: ${feedbackType.toUpperCase()}`);
                          console.log(`   • Feedback Priority: ${feedbackPriority.toUpperCase()}`);
                          console.log(`\n📋 FULL MESSAGE TO SALES AGENT (${estimatedTokens} token):`);
                          console.log(`${'─'.repeat(90)}`);
                          console.log(feedbackContent);
                          console.log(`${'─'.repeat(90)}`);
                          console.log(`📊 TOKEN METRICS:`);
                          console.log(`   • Message size: ${feedbackContent.length} characters`);
                          console.log(`   • Estimated tokens: ${estimatedTokens} (at ~4 chars/token)`);
                          console.log(`   • Priority: ${feedbackPriority}`);
                          console.log(`${'═'.repeat(90)}\n`);
                          
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
                          const analysisTimestamp = new Date().toISOString();
                          const managerAnalysisPayload = {
                            type: 'sales_manager_analysis',
                            timestamp: analysisTimestamp,
                            analysis: {
                              timestamp: analysisTimestamp,
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
                              injectedInstruction: injectedInstructionForUI, // 🆕 The ACTUAL message sent to the sales agent
                              currentPhase: {
                                id: state.currentPhase,
                                name: currentPhaseName,
                                stepName: currentStepName
                              },
                              profilingResult: analysis.profilingResult ? {
                                archetype: analysis.profilingResult.archetype,
                                confidence: analysis.profilingResult.confidence,
                                filler: analysis.profilingResult.filler,
                                instruction: analysis.profilingResult.instruction
                              } : null,
                              archetypeState: analysis.archetypeState ? {
                                current: analysis.archetypeState.current,
                                confidence: analysis.archetypeState.confidence,
                                consecutiveSignals: analysis.archetypeState.consecutiveSignals,
                                turnsSinceUpdate: analysis.archetypeState.turnsSinceUpdate
                              } : null,
                              checkpointsCompleted: state.checkpointsCompleted || [],
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
              currentAiSpokenText = ''; // Reset spoken text too
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
        
        if (code === 1006) {
          console.log(`\n⚠️  ERROR 1006: Abnormal Closure (no close frame received)`);
          console.log(`   This error typically means:`);
          console.log(`   1. Connection was terminated unexpectedly`);
          console.log(`   2. Network interruption occurred`);
          console.log(`   3. Server rejected the request before sending a response`);
          console.log(`   4. Invalid WebSocket frame or protocol violation`);
          console.log(`   5. Proxy/firewall interference`);
          console.log(`\n🔧 Debugging info:`);
          console.log(`   - Backend: ${liveApiBackend}`);
          console.log(`   - Model ID: ${liveModelId}`);
          console.log(`   - Voice: ${voiceName}`);
          console.log(`   - System instruction length: ${systemInstruction?.length || 0} chars`);
          console.log(`   - Reason buffer length: ${reason.length} bytes`);
          console.log(`   - Reason hex: ${reason.toString('hex')}`);
          console.log(`\n💡 The "Invalid frame header" browser error suggests:`);
          console.log(`   - Gemini might have sent binary data that wasn't expected`);
          console.log(`   - Or Gemini immediately closed with an error message`);
          console.log(`   - Check previous logs for RAW data received`);
        }
        
        if (code === 1007) {
          console.log(`\n⚠️  ERROR 1007: Request contains an invalid argument`);
          console.log(`   Backend: ${liveApiBackend}`);
          console.log(`   Possible causes:`);
          console.log(`   1. Invalid model path format`);
          console.log(`   2. Unsupported voice name for the model`);
          console.log(`   3. Invalid parameter naming (camelCase vs snake_case)`);
          console.log(`   4. System instruction too long or malformed`);
          console.log(`   5. Invalid response modalities configuration`);
          console.log(`\n🔧 Troubleshooting steps:`);
          console.log(`   - Check if model ID is correct: ${liveModelId}`);
          console.log(`   - Backend is: ${liveApiBackend} (${liveApiBackend === 'google_ai_studio' ? 'camelCase params' : 'snake_case params'})`);
          console.log(`   - Verify voice "${voiceName}" is supported by this model`);
          console.log(`   - Check system instruction length: ${systemInstruction?.length || 0} chars`);
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // 📞 PHONE CALL SESSION RESUME: When Gemini closes after GoAway for a phone call,
        // notify VPS to keep FreeSWITCH call alive and initiate a new WebSocket to Replit with resume handle.
        // NOTE: Cleanup still runs below to release timers/trackers for THIS connection.
        // The VPS bridge should open a NEW connection with the resume handle, creating a fresh session.
        if (goAwayReceived && isPhoneCall && lastSessionHandle && clientWs.readyState === WebSocket.OPEN) {
          geminiReconnectAttempts++;
          
          if (turnsInCurrentSegment === 0) {
            consecutiveSilentResumes++;
            console.log(`🔇 [${connectionId}] Silent segment detected (no user speech in last ~10 min) - consecutive: ${consecutiveSilentResumes}/${MAX_CONSECUTIVE_SILENT_RESUMES}`);
          } else {
            consecutiveSilentResumes = 0;
          }
          
          if (consecutiveSilentResumes >= MAX_CONSECUTIVE_SILENT_RESUMES) {
            console.log(`\n🚫━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🚫 [${connectionId}] CALL TERMINATED - ${MAX_CONSECUTIVE_SILENT_RESUMES} consecutive silent resumes`);
            console.log(`   → No user speech detected for ~${MAX_CONSECUTIVE_SILENT_RESUMES * 10} minutes`);
            console.log(`   → Likely abandoned call - closing to save API costs`);
            console.log(`🚫━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            try {
              clientWs.send(JSON.stringify({
                type: 'call_terminated',
                reason: 'no_user_activity',
                message: 'Call ended due to prolonged inactivity',
                silentMinutes: MAX_CONSECUTIVE_SILENT_RESUMES * 10
              }));
              clientWs.close(1000, 'No user activity detected');
            } catch (e) {
              console.error(`❌ [${connectionId}] Failed to send termination message:`, e);
            }
            
            goAwayReceived = false;
          } else {
          
          const segmentTurns = turnsInCurrentSegment;
          turnsInCurrentSegment = 0;
          
          console.log(`\n📞━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`📞 [${connectionId}] PHONE CALL SESSION EXPIRED - SENDING RESUME HANDLE TO VPS`);
          console.log(`   → GoAway was received, Gemini closed after 10-min timeout`);
          console.log(`   → Attempt: ${geminiReconnectAttempts}/${MAX_GEMINI_RECONNECT_ATTEMPTS}`);
          console.log(`   → Resume handle available: ${lastSessionHandle.substring(0, 20)}...`);
          console.log(`   → User spoke ${segmentTurns} times in last segment (silent streak: ${consecutiveSilentResumes})`);
          console.log(`   → VPS should open NEW WebSocket to Replit with resumeHandle param`);
          console.log(`   → FreeSWITCH call should stay alive during reconnection gap`);
          console.log(`   → This connection's cleanup will proceed normally below`);
          console.log(`📞━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          
          isGoAwayReconnecting = true;
          try {
            clientWs.send(JSON.stringify({
              type: 'gemini_reconnecting',
              message: 'Gemini session timeout - reconnecting seamlessly',
              resumeHandle: lastSessionHandle,
              attempt: geminiReconnectAttempts,
              maxAttempts: MAX_GEMINI_RECONNECT_ATTEMPTS,
              silentStreak: consecutiveSilentResumes,
              action: 'KEEP_CALL_ALIVE_AND_RECONNECT'
            }));
          } catch (e) {
            console.error(`❌ [${connectionId}] Failed to send reconnect message to VPS:`, e);
          }
          
          goAwayReceived = false;
          }
          // NOTE: Cleanup continues below - this connection is done.
          // VPS bridge must handle 'gemini_reconnecting' message by opening a new WS connection
          // with the resumeHandle as query parameter. Do NOT close clientWs here.
        }
        
        // 🚨 RESOURCE_EXHAUSTED: Propagate to client to stop reconnect loop
        if (reasonText.includes('RESOURCE_EXHAUSTED')) {
          console.log(`🚨 [${connectionId}] RESOURCE_EXHAUSTED detected - notifying client to stop reconnecting`);
          try {
            clientWs.send(JSON.stringify({
              type: 'error',
              errorType: 'RESOURCE_EXHAUSTED',
              message: 'Troppe sessioni attive. Aspetta qualche minuto e riprova.',
              details: reasonText
            }));
            // Close with specific code that client can detect
            clientWs.close(4429, 'RESOURCE_EXHAUSTED');
          } catch (e) {
            // Client may already be closed
          }
        }
        
        // 🔄 ERROR 1011: Insufficient model resources - notify client to reconnect
        // NOTE: We don't attempt server-side retry because it would require reattaching all
        // event handlers which is complex and error-prone. Instead, we notify the client
        // to initiate a fresh connection.
        if (code === 1011 || reasonText.includes('Insufficient model resources')) {
          const isVpsCall = mode === 'phone' || mode === 'phone_outbound' || mode === 'voice_call' || isPhoneCall;
          
          console.log(`\n🔄 [${connectionId}] ERROR 1011: Gemini risorse insufficienti`);
          console.log(`   → Mode: ${mode}, isPhoneCall: ${isPhoneCall}, isVpsCall: ${isVpsCall}`);
          
          // 🔧 FIX: Always clean up from tracker
          activeGeminiConnections.delete(connectionId);
          console.log(`   → Rimosso da connection tracker (remaining: ${activeGeminiConnections.size})`);
          
          // For VPS calls, send a special message that VPS can use to retry the call
          if (isVpsCall && clientWs.readyState === WebSocket.OPEN) {
            console.log(`   → Notifica VPS: richiesta nuova chiamata`);
            try {
              clientWs.send(JSON.stringify({
                type: 'error',
                errorType: 'GEMINI_OVERLOADED',
                retryable: true,
                retryDelayMs: 3000,
                message: 'Gemini temporaneamente sovraccarico. Riprova tra qualche secondo.',
                details: reasonText || 'Insufficient model resources'
              }));
              clientWs.close(4011, 'GEMINI_OVERLOADED');
            } catch (e) {}
          } else {
            // Browser call: notify client to retry
            console.log(`   → Notifica browser: retry suggerito`);
            try {
              clientWs.send(JSON.stringify({
                type: 'error',
                errorType: 'RETRY_SUGGESTED',
                retryable: true,
                retryDelayMs: 2000,
                message: 'Riconnessione...',
                details: reasonText || 'Insufficient model resources'
              }));
              clientWs.close(4011, 'RETRY_SUGGESTED');
            } catch (e) {}
          }
        }
        
        // ⏱️  CLEANUP: Stop time update interval
        if (timeUpdateInterval) {
          clearInterval(timeUpdateInterval);
          timeUpdateInterval = null;
          console.log(`⏱️  [${connectionId}] Time update scheduler stopped (Gemini close)`);
        }
        
        // 🦮 CLEANUP: Stop super-watchdog
        stopSuperWatchdog();
        
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
        
        // 📊 TOKEN TRACKING: Fire-and-forget track accumulated session usage
        if (consultantId && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          const sessionDurationMs = sessionStartTime ? Date.now() - sessionStartTime : undefined;
          tokenTracker.track({
            consultantId,
            clientId: userId || undefined,
            model: liveModelId || 'gemini-live-2.5-flash-native-audio',
            feature: voiceAgentName ? `voice-call:${voiceAgentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : 'voice-call',
            requestType: 'live',
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            cachedTokens: totalCachedTokens,
            thinkingTokens: totalThinkingTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            durationMs: sessionDurationMs,
          }).catch(e => console.error(`[LiveSession TokenTracker] Error:`, e));
        }

        // 🔌 CLEANUP: Remove from connection tracker on normal close
        if (activeGeminiConnections.has(connectionId)) {
          activeGeminiConnections.delete(connectionId);
          console.log(`🔌 [${connectionId}] Removed from connection tracker on Gemini close (remaining: ${activeGeminiConnections.size})`);
        }
        
        isSessionActive = false;
        
        if (isPhoneCall && !goAwayReceived && clientWs.readyState === WebSocket.OPEN) {
          console.log(`📞 [${connectionId}] Closing phone WebSocket (Gemini session ended)`);
          try {
            clientWs.close(1000, 'Gemini session ended');
          } catch (e) {}
        }
      });

      console.log(`✅ [${connectionId}] Gemini Live session created successfully`);

      // Track last audio log time for throttling
      let lastAudioLogTime = 0;
      const AUDIO_LOG_INTERVAL_MS = 30000; // 30 secondi
      let audioChunkDiagCount = 0; // Counter for audio diagnostic logging

      // 4. Browser → Gemini relay
      clientWs.on('message', async (data: any, isBinary?: boolean) => {
        try {
          // FAST PATH: Binary messages from phone VPS = raw PCM audio (no JSON overhead)
          if (isBinary && isPhoneCall && Buffer.isBuffer(data) && data.length > 0) {
            if (geminiSession && isSessionActive && geminiSession.readyState === WebSocket.OPEN) {
              // Inject pending feedback before audio if needed
              if (pendingFeedbackForAI) {
                console.log(`🚀 [${connectionId}] INJECTING FEEDBACK (Pre-Flight Binary)`);
                const feedbackPayload = {
                  clientContent: {
                    turns: [{ role: 'user', parts: [{ text: pendingFeedbackForAI }] }],
                    turnComplete: false
                  }
                };
                geminiSession.send(JSON.stringify(feedbackPayload));
                pendingFeedbackForAI = null;
              }

              lastPhoneAudioReceivedTime = Date.now();
              
              const audioMessage = liveApiBackend === 'google_ai_studio' 
                ? { realtimeInput: { mediaChunks: [{ data: data.toString('base64'), mimeType: 'audio/pcm' }] } }
                : { realtime_input: { media_chunks: [{ data: data.toString('base64'), mime_type: 'audio/pcm' }] } };
              geminiSession.send(JSON.stringify(audioMessage));
              audioChunksSentSinceLastResponse++;
              lastActivityTimestamp = Date.now();
              updateConnectionActivity(connectionId);
            } else {
              if (!lastDiscardedAudioLogTime || Date.now() - lastDiscardedAudioLogTime > 5000) {
                console.warn(`⚠️ [${connectionId}] Phone audio DISCARDED - gemini=${!!geminiSession}, active=${isSessionActive}, readyState=${geminiSession?.readyState ?? 'null'}`);
                lastDiscardedAudioLogTime = Date.now();
              }
            }
            return;
          }

          const msg: LiveMessage = JSON.parse(data.toString());
          
            if (msg.type === 'audio' && msg.data) {

                // 🔍 AUDIO DIAGNOSTIC: Log first 3 chunks to verify format
                // Use internal counter instead of sequence (works with resumed sessions)
                if (!audioChunkDiagCount) audioChunkDiagCount = 0;
                audioChunkDiagCount++;
                if (audioChunkDiagCount <= 3) {
                  try {
                    const base64Data = msg.data as string;
                    const binaryData = Buffer.from(base64Data, 'base64');
                    const numBytes = binaryData.length;
                    const numSamples = numBytes / 2; // PCM16 = 2 bytes per sample
                    
                    // Calculate implied duration at 16kHz
                    const durationMs16kHz = (numSamples / 16000) * 1000;
                    // Calculate implied duration at 48kHz (if browser sent wrong rate)
                    const durationMs48kHz = (numSamples / 48000) * 1000;
                    
                    // Calculate RMS to check if there's actual audio
                    let sumSquares = 0;
                    for (let i = 0; i < binaryData.length - 1; i += 2) {
                      const sample = binaryData.readInt16LE(i);
                      sumSquares += sample * sample;
                    }
                    const rms = Math.sqrt(sumSquares / numSamples);
                    const rmsNormalized = rms / 32768; // Normalize to 0-1
                    
                    console.log(`\n🔬 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`🔬 [${connectionId}] AUDIO DIAGNOSTIC - Chunk #${audioChunkDiagCount}`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                    console.log(`   📦 Base64 length: ${base64Data.length} chars`);
                    console.log(`   📦 Binary size: ${numBytes} bytes`);
                    console.log(`   🎵 Samples: ${numSamples}`);
                    console.log(`   ⏱️  Duration @16kHz: ${durationMs16kHz.toFixed(1)}ms`);
                    console.log(`   ⏱️  Duration @48kHz: ${durationMs48kHz.toFixed(1)}ms (if wrong rate)`);
                    console.log(`   📊 RMS level: ${rmsNormalized.toFixed(6)} (${rms.toFixed(0)}/32768)`);
                    console.log(`   🎯 Expected: ~40ms chunks @16kHz = 640 samples = 1280 bytes`);
                    console.log(`   ⚠️  If samples >> 640, audio is NOT resampled to 16kHz!`);
                    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
                  } catch (diagError) {
                    console.error(`❌ [${connectionId}] Audio diagnostic error:`, diagError);
                  }
                }

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
              const audioMessage = liveApiBackend === 'google_ai_studio'
                ? { realtimeInput: { mediaChunks: [{ data: msg.data, mimeType: 'audio/pcm' }] } }
                : { realtime_input: { media_chunks: [{ data: msg.data, mime_type: 'audio/pcm' }] } };
              geminiSession.send(JSON.stringify(audioMessage));
              
              // 🔬 DIAGNOSTIC: Track audio chunks sent to Gemini
              audioChunksSentSinceLastResponse++;
              lastActivityTimestamp = Date.now();
              
              // 🆕 P0.1 - Aggiorna tracker globale anti-zombie
              updateConnectionActivity(connectionId);
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
              
              // 🆕 P0.1 - Aggiorna tracker globale anti-zombie
              updateConnectionActivity(connectionId);
              
              // 🆕 FIX: Start watchdog for text messages too!
              // Previously watchdog was only started for audio messages with isFinal=true
              // This caused Gemini to sometimes not respond to text messages without detection
              startResponseWatchdog(msg.text, geminiSession);
              
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
          
          // 🆕 P0.3 - HEARTBEAT: Client manda ping ogni 30s
          if (msg.type === 'ping') {
            updateConnectionActivity(connectionId);
            // Rispondi con pong per confermare che server è vivo
            try {
              clientWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            } catch (e) {
              // Client già disconnesso
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
                // LOAD CONVERSATION DATA + AGENT CONFIG
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const conversation = await storage.getClientSalesConversationById(conversationId!);
                if (!conversation) {
                  console.error(`❌ [${connectionId}] Conversation not found: ${conversationId}`);
                  throw new Error('Conversation not found');
                }
                
                // Load agent config to check enableDiscovery/enableDemo settings
                const agentConfig = await storage.getClientSalesAgentById(conversation.agentId);
                const agentEnableDiscovery = agentConfig?.enableDiscovery ?? true;
                const agentEnableDemo = agentConfig?.enableDemo ?? true;
                
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
                console.log(`   🎯 Agent Mode: discovery=${agentEnableDiscovery}, demo=${agentEnableDemo}`);
                
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // 1. PHASE TRANSITION DETECTION + DISCOVERY REC GENERATION
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // IMPORTANT: Phase transitions respect enableDiscovery/enableDemo settings
                // - discovery → demo: only if enableDemo = true
                // - demo → objections: only if in demo phase
                // - objections → closing: always allowed
                let newPhase = conversation.currentPhase;
                let generatedDiscoveryRec: DiscoveryRec | null = null;
                
                if (conversation.currentPhase === 'discovery') {
                  if (lowerTranscript.includes('passiamo alla demo') || 
                      lowerTranscript.includes('ti mostro come funziona') ||
                      lowerTranscript.includes('adesso ti mostro') ||
                      lowerTranscript.includes('vediamo come funziona')) {
                    
                    // ⚠️ CHECK: Can we transition to demo?
                    if (agentEnableDemo) {
                      newPhase = 'demo';
                      console.log(`   🔄 PHASE TRANSITION: discovery → demo (enableDemo=true)`);
                    
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    // 📋 DISCOVERY REC GENERATION (usa Gemini 2.5 Flash)
                    // Genera un riassunto strutturato della discovery per la demo
                    // NOTA: Se fallisce, la demo procede comunque ma senza REC
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    console.log(`   📋 Generating Discovery REC...`);
                    
                    // Retry logic for REC generation
                    const maxRecRetries = 2;
                    for (let recAttempt = 1; recAttempt <= maxRecRetries; recAttempt++) {
                      try {
                        generatedDiscoveryRec = await generateDiscoveryRec(
                          fullTranscript,
                          consultantId || 'system'
                        );
                        
                        if (generatedDiscoveryRec) {
                          console.log(`   ✅ Discovery REC generated successfully (attempt ${recAttempt})`);
                          console.log(`      - Motivazione: ${generatedDiscoveryRec.motivazioneCall?.substring(0, 50)}...`);
                          console.log(`      - Urgenza: ${generatedDiscoveryRec.urgenza || 'N/D'}`);
                          console.log(`      - Decision Maker: ${generatedDiscoveryRec.decisionMaker || 'N/D'}`);
                          break; // Success - exit retry loop
                        } else {
                          console.log(`   ⚠️ Discovery REC generation returned null (attempt ${recAttempt}/${maxRecRetries})`);
                          if (recAttempt < maxRecRetries) {
                            await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                          }
                        }
                      } catch (recError: any) {
                        console.error(`   ❌ Error generating Discovery REC (attempt ${recAttempt}/${maxRecRetries}):`, recError.message);
                        if (recAttempt < maxRecRetries) {
                          await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
                        }
                      }
                    }
                    
                    // Log warning if REC generation failed after all retries
                    if (!generatedDiscoveryRec) {
                      console.log(`   ⚠️ Discovery REC NOT GENERATED after ${maxRecRetries} attempts`);
                      console.log(`      Demo will proceed without structured discovery summary`);
                    }
                    } else {
                      // ⚠️ Demo mode is NOT enabled - stay in discovery phase
                      // This is discovery-only mode: no transition allowed
                      console.log(`   ⛔ PHASE TRANSITION BLOCKED: discovery → demo`);
                      console.log(`      Reason: enableDemo=${agentEnableDemo} (discovery-only mode)`);
                      console.log(`      Action: Staying in discovery phase`);
                    }
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
                if (generatedDiscoveryRec) {
                  console.log(`      - Discovery REC: ✅ INCLUDED`);
                }
                
                // Build update object
                const updateData: any = {
                  currentPhase: newPhase,
                  collectedData: collectedData,
                  objectionsRaised: allObjections,
                  outcome: outcome
                };
                
                // Include Discovery REC if generated (at discovery→demo transition)
                if (generatedDiscoveryRec) {
                  updateData.discoveryRec = generatedDiscoveryRec;
                }
                
                await storage.updateClientSalesConversation(conversationId!, updateData);
                
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
                const pendingSpoken = currentAiSpokenText.trim() || currentAiTranscript.trim();
                conversationMessages.push({
                  role: 'assistant',
                  transcript: pendingSpoken,
                  duration: 0,
                  timestamp: new Date().toISOString()
                });
                console.log(`   💬 Added pending AI message to flush queue: "${pendingSpoken.substring(0, 50)}..."`);
                currentAiTranscript = '';
                currentAiSpokenText = '';
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
        
        // 🔌 Remove from connection tracker
        if (activeGeminiConnections.has(connectionId)) {
          activeGeminiConnections.delete(connectionId);
          console.log(`🔌 [${connectionId}] Removed from connection tracker (remaining: ${activeGeminiConnections.size})`);
        }
        
        // 📞 VOICE CALL CLEANUP: Update voice_calls record if this was a phone call
        if (voiceCallId) {
          // Clear transcript update timeout
          if (transcriptUpdateTimeout) {
            clearTimeout(transcriptUpdateTimeout);
            transcriptUpdateTimeout = null;
          }
          
          try {
            const endedAt = new Date();
            const activeCall = activeVoiceCalls.get(voiceCallId);
            const startTime = activeCall?.startedAt || new Date();
            const durationSeconds = Math.round((endedAt.getTime() - startTime.getTime()) / 1000);
            const recoveredScheduledCallId = activeCall?.scheduledCallId || null;
            
            // Use conversationMessages directly for final transcript (already accumulated during call)
            let transcriptText = '';
            if (conversationMessages.length > 0) {
              transcriptText = conversationMessages
                .map(m => `[${m.role === 'user' ? 'Utente' : 'Alessia'}] ${m.transcript}`)
                .join('\n');
            } else if (currentAiConversationId) {
              // Fallback: fetch from ai_messages if conversationMessages is empty
              try {
                const messages = await db.execute(sql`
                  SELECT role, content FROM ai_messages 
                  WHERE conversation_id = ${currentAiConversationId}
                  ORDER BY created_at ASC
                `);
                transcriptText = (messages.rows as any[])
                  .map(m => `[${m.role === 'user' ? 'Utente' : 'Alessia'}] ${m.content}`)
                  .join('\n');
                console.log(`📞 [${connectionId}] Fallback: fetched ${messages.rows.length} messages from ai_messages`);
              } catch (e) {
                console.warn(`⚠️ [${connectionId}] Could not fetch transcript fallback from ai_messages`);
              }
            }
            
            const isFailedInit = code === 4500 || (code !== 1000 && durationSeconds <= 3 && conversationMessages.length === 0);
            const vcStatus = isFailedInit ? 'failed' : 'completed';

            let recordingUrl: string | null = null;
            if (phoneFsUuid && !phoneFsUuid.startsWith('ws_') && consultantId) {
              try {
                const vpsBridgeResult = await db.execute(sql`
                  SELECT vps_bridge_url FROM consultant_availability_settings
                  WHERE consultant_id = ${consultantId} AND vps_bridge_url IS NOT NULL
                  LIMIT 1
                `);
                const vpsBridgeUrl = (vpsBridgeResult.rows[0] as any)?.vps_bridge_url;
                if (vpsBridgeUrl) {
                  recordingUrl = `${vpsBridgeUrl}/recordings/${phoneFsUuid}.wav`;
                  console.log(`🎙️ [${connectionId}] Recording URL: ${recordingUrl}`);
                }
              } catch (vpErr) {
                console.warn(`⚠️ [${connectionId}] Could not fetch vps_bridge_url for recording:`, vpErr);
              }
            }

            await db
              .update(voiceCalls)
              .set({
                status: vcStatus,
                endedAt: endedAt,
                durationSeconds: durationSeconds,
                fullTranscript: transcriptText || null,
                aiConversationId: currentAiConversationId || null,
                outcome: code === 1000 ? 'normal_end' : `disconnect_${code}`,
                recordingUrl: recordingUrl,
                updatedAt: new Date(),
              })
              .where(eq(voiceCalls.id, voiceCallId));
            
            // Remove from active calls tracking
            activeVoiceCalls.delete(voiceCallId);
            
            console.log(`📞 [${connectionId}] Voice call ${voiceCallId} ${vcStatus} - Duration: ${durationSeconds}s${isFailedInit ? ' (failed init)' : ''}`);

            if (consultantId) {
              try {
                const drainFn = (globalThis as any).__drainCallQueue;
                if (drainFn) {
                  console.log(`🔄 [${connectionId}] Channel freed — draining call queue for consultant ${consultantId.substring(0, 8)}...`);
                  drainFn(consultantId).catch((err: any) => console.error(`[${connectionId}] drainCallQueue error:`, err.message));
                }
              } catch (drainErr: any) {
                console.error(`[${connectionId}] drainCallQueue error:`, drainErr.message);
              }
            }

            // 🔗 SYNC: Resolve effective scheduledCallId (from WS param or activeVoiceCalls map fallback)
            let effectiveScheduledCallId = phoneScheduledCallId;
            if (!effectiveScheduledCallId && recoveredScheduledCallId) {
              effectiveScheduledCallId = recoveredScheduledCallId;
              console.log(`📞 [LIFECYCLE] WS Close: phoneScheduledCallId was UNDEFINED — recovered scheduledCallId=${effectiveScheduledCallId} from activeVoiceCalls map`);
            }

            if (phoneCallerId && consultantId) {
              try {
                const { ensureProactiveLead } = await import('../utils/ensure-proactive-lead');
                const callSource = effectiveScheduledCallId ? 'voice_outbound' : 'voice_inbound';
                await ensureProactiveLead({
                  consultantId,
                  phoneNumber: phoneCallerId,
                  source: callSource,
                  status: 'contacted',
                });
              } catch (epErr: any) {
                console.error(`[${connectionId}] ensureProactiveLead error (non-blocking):`, epErr.message);
              }
            }
            console.log(`📞 [LIFECYCLE] WS Close: effectiveScheduledCallId=${effectiveScheduledCallId || 'NONE'} | voiceCallId=${voiceCallId} | isGoAwayReconnecting=${isGoAwayReconnecting} | duration=${durationSeconds}s | code=${code}`);
            if (!effectiveScheduledCallId) {
              console.log(`📞 [LIFECYCLE] No scheduledCallId available (inbound call or param missing) — scheduled_voice_calls not updated`);
            }
            if (effectiveScheduledCallId && isGoAwayReconnecting) {
              console.log(`🔄 [${connectionId}] Skipping scheduled_voice_call completion — GoAway reconnect in progress (call still active)`);
            } else if (effectiveScheduledCallId) {
              try {
                const svcStatus = isFailedInit ? 'failed' : 'completed';
                await db.execute(sql`
                  UPDATE scheduled_voice_calls 
                  SET status = ${svcStatus},
                      voice_call_id = ${voiceCallId},
                      duration_seconds = ${durationSeconds},
                      hangup_cause = ${code === 1000 ? 'normal_end' : `disconnect_${code}`},
                      last_attempt_at = NOW(),
                      updated_at = NOW()
                  WHERE id = ${effectiveScheduledCallId}
                `);
                console.log(`🔗 [${connectionId}] Synced scheduled_voice_call ${effectiveScheduledCallId} -> ${svcStatus}`);
                
                const svcResult = await db.execute(sql`
                  SELECT source_task_id FROM scheduled_voice_calls WHERE id = ${effectiveScheduledCallId}
                `);
                const sourceTaskId = (svcResult.rows[0] as any)?.source_task_id;
                
                if (sourceTaskId) {
                  const taskResult = await db.execute(sql`
                    SELECT * FROM ai_scheduled_tasks WHERE id = ${sourceTaskId}
                  `);
                  const task = taskResult.rows[0] as any;
                  
                  await db.execute(sql`
                    UPDATE ai_scheduled_tasks 
                    SET status = 'completed',
                        result_summary = ${'Chiamata completata con successo (' + durationSeconds + 's)'},
                        voice_call_id = ${voiceCallId},
                        completed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ${sourceTaskId}
                  `);
                  console.log(`🔗 [${connectionId}] Synced AI Task ${sourceTaskId} -> completed`);
                  
                  if (task && task.recurrence_type && task.recurrence_type !== 'once') {
                    try {
                      const { scheduleNextRecurrence } = await import('../cron/ai-task-scheduler');
                      await scheduleNextRecurrence(task);
                      console.log(`📅 [${connectionId}] Scheduled next recurrence for task ${sourceTaskId}`);
                    } catch (recErr: any) {
                      console.error(`⚠️ [${connectionId}] Failed to schedule recurrence:`, recErr.message);
                    }
                  }
                }
              } catch (syncErr: any) {
                console.error(`⚠️ [${connectionId}] Failed to sync scheduled_voice_call:`, syncErr.message);
              }
            }
          } catch (vcErr) {
            console.error(`❌ [${connectionId}] Failed to update voice call record:`, vcErr);
          }
        }
        
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
        
        // 🦮 CLEANUP: Stop super-watchdog
        stopSuperWatchdog();
        
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
          const closeSpoken = currentAiSpokenText.trim() || currentAiTranscript.trim();
          conversationMessages.push({
            role: 'assistant',
            transcript: closeSpoken,
            duration: 0,
            timestamp: new Date().toISOString()
          });
          console.log(`💾 [${connectionId}] Saved pending AI message on close: "${closeSpoken.substring(0, 50)}..."`);
          currentAiTranscript = '';
          currentAiSpokenText = '';
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
                        consultantId: consultantId,
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
                userId,
                consultantId!,
                conversationData,
                voiceName,
                sessionType,
                phoneCallerId // Pass caller phone for anonymous callers
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
  
  return wss;
}

/**
 * Salva conversazione vocale nel database
 */
async function saveConversation(
  userId: string | null,
  consultantId: string,
  conversationData: NonNullable<LiveMessage['conversationData']>,
  voiceName?: string,
  sessionType?: 'weekly_consultation' | null,
  callerPhone?: string | null
): Promise<string> {
  try {
    console.log(`💾 Saving voice conversation for user ${userId || 'anonymous'} (consultant: ${consultantId}, callerPhone: ${callerPhone || 'none'})...`);

    // Trova il timestamp dell'ultimo messaggio per lastMessageAt
    const lastMessageTimestamp = conversationData.messages.length > 0
      ? new Date(conversationData.messages[conversationData.messages.length - 1].timestamp)
      : new Date();

    // Build conversation values - either clientId OR callerPhone must be set
    const conversationValues: any = {
      title: generateConversationTitle(conversationData.messages),
      mode: 'live_voice',
      consultantId: consultantId,
      lastMessageAt: lastMessageTimestamp,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (userId) {
      conversationValues.clientId = userId;
    } else if (callerPhone) {
      conversationValues.callerPhone = callerPhone;
    }

    // Crea conversazione
    const [conversation] = await db.insert(aiConversations).values(conversationValues).returning();

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
