// AI Service
// Referenced from blueprint:javascript_gemini
// Handles Gemini API calls and AI conversation management

import { performance } from 'perf_hooks';
import { GoogleGenAI } from "@google/genai";
import { db } from "./db";
import { aiConversations, aiMessages, aiUserPreferences, users, superadminGeminiConfig, consultantWhatsappConfig, aiAssistantPreferences, fileSearchDocuments } from "../shared/schema";
import { decrypt } from "./encryption";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { buildUserContext, UserContext } from "./ai-context-builder";
import { buildSystemPrompt, AIMode, ConsultantType } from "./ai-prompts";
import { buildConsultantContext, detectConsultantIntent, ConsultantContext, ConsultantIntent } from "./consultant-context-builder";
import { consultantGuides, formatGuidesForPrompt } from "./consultant-guides";
import { trackDocumentUsage, trackApiUsage, trackClientDocumentUsage, trackClientApiUsage } from "./services/knowledge-searcher";
import { extractUrls, scrapeMultipleUrls, isGoogleSheetsUrl, scrapeGoogleDoc } from "./web-scraper";
import {
  getCachedExercise,
  getStaleCachedExercise,
  setCachedExercise,
  detectModificationHint,
  detectMentionedExercises,
  updateConversationalContext,
  logCacheStats,
} from "./exercise-scrape-cache";
import {
  retryWithBackoff,
  streamWithBackoff,
  AiRetryEvent,
  AiProviderMetadata,
  AiRetryContext,
  OperationAttemptContext,
  GeminiUsageMetadata,
} from "./ai/retry-manager";
import { getAIProvider, AiProviderResult, getGoogleAIStudioClientForFileSearch } from "./ai/provider-factory";
import { fileSearchService } from "./ai/file-search-service";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// Gemini 3 Flash Preview for text chat (testing new model)
// Set USE_GEMINI_3 to true to enable Gemini 3 for Google AI Studio only
// NOTE: gemini-3-flash-preview is available on Google AI Studio but may not be enabled on all Vertex AI projects
const USE_GEMINI_3_FOR_STUDIO = true;
const GEMINI_3_MODEL = "gemini-3-flash-preview";
const GEMINI_3_THINKING_LEVEL: "minimal" | "low" | "medium" | "high" = "low";

// Legacy model for Vertex AI and Live API (Gemini 3 does NOT support Live API)
const GEMINI_LEGACY_MODEL = "gemini-2.5-flash";

// Get the appropriate model for text chat based on provider
// providerName: 'Vertex AI (tuo)' | 'Vertex AI (admin)' | 'Google AI Studio'
function getTextChatModel(providerName: string): { model: string; useThinking: boolean } {
  // Use Gemini 3 Flash Preview only for Google AI Studio (Vertex AI doesn't support it yet in all projects)
  const isGoogleAIStudio = providerName === 'Google AI Studio';
  if (USE_GEMINI_3_FOR_STUDIO && isGoogleAIStudio) {
    return { model: GEMINI_3_MODEL, useThinking: true };
  }
  return { model: GEMINI_LEGACY_MODEL, useThinking: false };
}

// Default model for backward compatibility (uses legacy)
const TEXT_CHAT_MODEL = GEMINI_LEGACY_MODEL;

// Streaming adapter: wraps streamWithBackoff and maps AiRetryEvent to ChatStreamChunk
async function* streamWithRetriesAdapter(
  streamFactory: (ctx: OperationAttemptContext) => Promise<AsyncIterable<{ text?: string }>>,
  conversationId: string,
  provider: AiProviderMetadata
): AsyncGenerator<ChatStreamChunk> {
  const retryContext: AiRetryContext = {
    conversationId,
    provider,
    emit: () => {}, // No-op for streaming (events yielded directly)
  };

  for await (const event of streamWithBackoff(streamFactory, retryContext)) {
    // Map AiRetryEvent to ChatStreamChunk with provider metadata
    switch (event.type) {
      case 'retry':
        // Map retry event with structured fields (not JSON)
        yield {
          type: 'retry',
          conversationId: event.conversationId,
          provider: event.provider,
          attempt: event.attempt,
          maxAttempts: event.maxAttempts,
          delayMs: event.delayMs,
          nextRetryAt: event.nextRetryAt,
          message: event.message,
        };
        break;

      case 'heartbeat':
        // Map heartbeat event with structured fields (not JSON)
        yield {
          type: 'heartbeat',
          conversationId: event.conversationId,
          provider: event.provider,
          remainingMs: event.remainingMs,
        };
        break;

      case 'start':
        // Map start event with provider metadata
        yield {
          type: 'start',
          conversationId: event.conversationId,
          provider: event.provider,
        };
        break;

      case 'delta':
        // Map delta event with provider metadata
        yield {
          type: 'delta',
          conversationId: event.conversationId,
          provider: event.provider,
          content: event.content,
        };
        break;

      case 'complete':
        // CRITICAL: Yield complete event for SSE termination and conversation persistence
        yield {
          type: 'complete',
          conversationId: event.conversationId,
          provider: event.provider,
          content: event.content,
          usageMetadata: event.usageMetadata,
        };
        break;

      case 'error':
        // Map error event with provider metadata
        yield {
          type: 'error',
          conversationId: event.conversationId,
          provider: event.provider,
          content: event.error,
        };
        break;
    }
  }
}

// Helper function to estimate token count (approximate: 4 chars = 1 token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Type for fileSearchBreakdown - includes REAL token counts from contentSize
type FileSearchBreakdownItem = {
  storeName: string;
  storeDisplayName: string;
  ownerType: string;
  categories: Record<string, number>;
  categoryTokens: Record<string, number>;  // REAL tokens from contentSize
  totalDocs: number;
  totalTokens: number;  // REAL total tokens
};

// Helper function to log token breakdown with File Search awareness
// NOW uses ACTUAL indexed document counts from fileSearchBreakdown
function logTokenBreakdown(
  breakdown: ReturnType<typeof calculateTokenBreakdown>,
  systemPromptTokens: number,
  hasFileSearch: boolean,
  fileSearchBreakdown?: FileSearchBreakdownItem[]
): void {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📊 SYSTEM PROMPT BREAKDOWN (~${systemPromptTokens.toLocaleString()} tokens)`);
  console.log(`${'═'.repeat(70)}`);

  if (hasFileSearch && fileSearchBreakdown && fileSearchBreakdown.length > 0) {
    // Aggregate REAL token counts from contentSize across all stores
    const indexedCounts: Record<string, number> = {};
    const indexedTokens: Record<string, number> = {};
    let totalIndexedTokens = 0;
    
    for (const store of fileSearchBreakdown) {
      for (const [cat, count] of Object.entries(store.categories)) {
        indexedCounts[cat] = (indexedCounts[cat] || 0) + count;
      }
      for (const [cat, tokens] of Object.entries(store.categoryTokens)) {
        indexedTokens[cat] = (indexedTokens[cat] || 0) + tokens;
      }
      totalIndexedTokens += store.totalTokens;
    }
    
    // Calculate total items in userContext (from breakdown which uses userContext)
    // These are approximate counts based on token estimates
    const TOKENS_PER_EXERCISE = 500;
    const TOKENS_PER_LIBRARY = 1000;
    const TOKENS_PER_CONSULTATION = 300;
    const TOKENS_PER_UNIVERSITY = 800;
    
    const totalExercisesInContext = Math.ceil(breakdown.exercises / TOKENS_PER_EXERCISE);
    const totalLibraryInContext = Math.ceil(breakdown.library / TOKENS_PER_LIBRARY);
    const totalConsultationsInContext = Math.ceil(breakdown.consultations / TOKENS_PER_CONSULTATION);
    const totalUniversityInContext = Math.ceil(breakdown.university / TOKENS_PER_UNIVERSITY);
    
    // File Search attivo - mostra cosa è nel prompt (solo metadata base)
    console.log(`\n📍 NEL SYSTEM PROMPT (${systemPromptTokens.toLocaleString()} tokens):`);
    console.log(`   👤 User Profile & Base: ~${systemPromptTokens.toLocaleString()} tokens`);
    console.log(`   ℹ️  (Include: data/ora, profilo utente, istruzioni AI, metadata esercizi)`);
    
    console.log(`\n🔍 VIA FILE SEARCH RAG (indicizzati, cercati su richiesta):`);
    if (indexedCounts['exercise'] > 0) {
      console.log(`   📚 Exercises: ${(indexedTokens['exercise'] || 0).toLocaleString()} tokens (${indexedCounts['exercise']}/${totalExercisesInContext} documenti)`);
    }
    if (indexedCounts['library'] > 0) {
      console.log(`   📖 Library: ${(indexedTokens['library'] || 0).toLocaleString()} tokens (${indexedCounts['library']}/${totalLibraryInContext} documenti)`);
    }
    if (indexedCounts['consultation'] > 0) {
      console.log(`   💬 Consultations: ${(indexedTokens['consultation'] || 0).toLocaleString()} tokens (${indexedCounts['consultation']}/${totalConsultationsInContext} documenti)`);
    }
    if (indexedCounts['knowledge_base'] > 0) {
      console.log(`   🧠 Knowledge Base: ${(indexedTokens['knowledge_base'] || 0).toLocaleString()} tokens (${indexedCounts['knowledge_base']} documenti)`);
    }
    const totalUniversityDocs = (indexedCounts['university'] || 0) + (indexedCounts['university_lesson'] || 0);
    const totalUniversityTokens = (indexedTokens['university'] || 0) + (indexedTokens['university_lesson'] || 0);
    if (totalUniversityDocs > 0) {
      console.log(`   🎓 University: ${totalUniversityTokens.toLocaleString()} tokens (${totalUniversityDocs}/${totalUniversityInContext} documenti)`);
    }
    if (indexedCounts['consultant_guide'] > 0) {
      console.log(`   📘 Consultant Guide: ${(indexedTokens['consultant_guide'] || 0).toLocaleString()} tokens (${indexedCounts['consultant_guide']} documenti)`);
    }
    
    const totalIndexedDocs = Object.values(indexedCounts).reduce((sum, count) => sum + count, 0);
    console.log(`\n   💰 TOTALE FILE SEARCH: ${totalIndexedTokens.toLocaleString()} tokens (${totalIndexedDocs} documenti indicizzati)`);
    
    // Show what's NOT available to AI (in userContext but not synced)
    const missingExercises = Math.max(0, totalExercisesInContext - (indexedCounts['exercise'] || 0));
    const missingLibrary = Math.max(0, totalLibraryInContext - (indexedCounts['library'] || 0));
    const missingConsultations = Math.max(0, totalConsultationsInContext - (indexedCounts['consultation'] || 0));
    const missingUniversity = Math.max(0, totalUniversityInContext - totalUniversityDocs);
    
    if (missingExercises > 0 || missingLibrary > 0 || missingConsultations > 0 || missingUniversity > 0) {
      console.log(`\n⚠️  NON DISPONIBILI ALL'AI (non sincronizzati in File Search):`);
      if (missingExercises > 0) {
        console.log(`   📚 Exercises: ~${(missingExercises * TOKENS_PER_EXERCISE).toLocaleString()} tokens (${missingExercises} documenti)`);
      }
      if (missingLibrary > 0) {
        console.log(`   📖 Library: ~${(missingLibrary * TOKENS_PER_LIBRARY).toLocaleString()} tokens (${missingLibrary} documenti)`);
      }
      if (missingConsultations > 0) {
        console.log(`   💬 Consultations: ~${(missingConsultations * TOKENS_PER_CONSULTATION).toLocaleString()} tokens (${missingConsultations} documenti)`);
      }
      if (missingUniversity > 0) {
        console.log(`   🎓 University: ~${(missingUniversity * TOKENS_PER_UNIVERSITY).toLocaleString()} tokens (${missingUniversity} documenti)`);
      }
      console.log(`   💡 TIP: Sincronizza questi documenti in File Search per renderli disponibili all'AI`);
    }
  } else {
    // File Search non attivo - tutto nel prompt
    console.log(`\n💰 Finance Data: ${breakdown.financeData.toLocaleString()} tokens (${((breakdown.financeData / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`📚 Exercises: ${breakdown.exercises.toLocaleString()} tokens (${((breakdown.exercises / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`📖 Library Docs: ${breakdown.library.toLocaleString()} tokens (${((breakdown.library / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`💬 Consultations: ${breakdown.consultations.toLocaleString()} tokens (${((breakdown.consultations / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`🎯 Goals & Tasks: ${breakdown.goals.toLocaleString()} tokens (${((breakdown.goals / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`⚡ Momentum & Calendar: ${breakdown.momentum.toLocaleString()} tokens (${((breakdown.momentum / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`📚 Knowledge Base: ${breakdown.knowledgeBase.toLocaleString()} tokens (${((breakdown.knowledgeBase / systemPromptTokens) * 100).toFixed(1)}%)`);
    console.log(`👤 User Profile & Base: ${breakdown.base.toLocaleString()} tokens (${((breakdown.base / systemPromptTokens) * 100).toFixed(1)}%)`);

    // University breakdown
    console.log(`\n🎓 UNIVERSITY: ${breakdown.university.toLocaleString()} tokens (${((breakdown.university / systemPromptTokens) * 100).toFixed(1)}%)`);
    if (breakdown.universityBreakdown) {
      console.log(`   └─ Overall Progress: ${breakdown.universityBreakdown.overallProgress.toLocaleString()} tokens`);

      for (const year of breakdown.universityBreakdown.years) {
        console.log(`   └─ 📅 ${year.yearTitle}: ${year.totalYearTokens.toLocaleString()} tokens`);

        for (const trimester of year.trimesters) {
          const totalLessons = trimester.modules.reduce((sum, m) => sum + m.lessons.length, 0);
          console.log(`      └─ ${trimester.trimesterTitle}: ${trimester.totalTrimesterTokens.toLocaleString()} tokens (${trimester.modules.length} moduli, ${totalLessons} lezioni)`);
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}

// Helper function to log File Search store breakdown with category details
const CATEGORY_LABELS: Record<string, string> = {
  'library': '📖 Libreria',
  'knowledge_base': '🧠 Knowledge Base',
  'exercise': '🏋️ Esercizi',
  'consultation': '💬 Consulenze',
  'university': '🎓 University',
  'university_lesson': '🎓 Lezioni',
  'goal': '🎯 Obiettivi',
  'task': '✅ Task',
  'daily_reflection': '❤️ Riflessioni',
  'client_progress': '📈 Progressi',
  'library_progress': '📚 Progr. Libreria',
  'email_journey': '📧 Email Journey',
  'financial_data': '💰 Dati Finanziari',
  'manual': '📝 Manuali',
  'other': '📄 Altri'
};

function logFileSearchBreakdown(
  breakdown: Array<{
    storeName: string;
    storeDisplayName: string;
    ownerType: string;
    categories: Record<string, number>;
    totalDocs: number;
  }>
) {
  if (breakdown.length === 0) return;
  
  console.log(`\n   📊 BREAKDOWN DOCUMENTI PER STORE:`);
  for (const store of breakdown) {
    const ownerIcon = store.ownerType === 'consultant' ? '👤' : store.ownerType === 'client' ? '👥' : '🌐';
    console.log(`\n   ${ownerIcon} ${store.storeDisplayName} (${store.totalDocs} documenti):`);
    
    const sortedCategories = Object.entries(store.categories)
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
    
    for (const [cat, count] of sortedCategories) {
      const label = CATEGORY_LABELS[cat] || `📄 ${cat}`;
      console.log(`      ${label}: ${count}`);
    }
  }
}

// Calculate detailed token breakdown by context section
function calculateTokenBreakdown(userContext: UserContext, intent: string): {
  financeData: number;
  exercises: number;
  library: number;
  university: number;
  consultations: number;
  goals: number;
  base: number;
  momentum: number;
  knowledgeBase: number; // Added Knowledge Base tokens for CLIENT
  universityBreakdown?: { // Added for detailed breakdown
    overallProgress: number;
    years: Array<{
      yearTitle: string;
      totalYearTokens: number;
      yearBase: number;
      trimesters: Array<{
        trimesterTitle: string;
        totalTrimesterTokens: number;
        trimesterBase: number;
        modules: Array<{
          moduleTitle: string;
          totalModuleTokens: number;
          moduleBase: number;
          lessons: Array<{
            lessonTitle: string;
            tokens: number;
          }>;
        }>;
      }>;
    }>;
  };
} {
  // Finance data
  const financeTokens = userContext.financeData
    ? estimateTokens(JSON.stringify(userContext.financeData))
    : 0;

  // Exercises (all + with content)
  const exercisesStr = JSON.stringify(userContext.exercises);
  const exercisesTokens = estimateTokens(exercisesStr);

  // Library documents
  const libraryStr = JSON.stringify(userContext.library.documents);
  const libraryTokens = estimateTokens(libraryStr);

  // University data
  const universityStr = JSON.stringify(userContext.university);
  const universityTokens = estimateTokens(universityStr);

  // Consultations
  const consultationsStr = JSON.stringify({
    upcoming: userContext.consultations.upcoming,
    recent: userContext.consultations.recent,
    tasks: userContext.consultationTasks
  });
  const consultationsTokens = estimateTokens(consultationsStr);

  // Goals + Daily tasks + Today reflection
  const goalsStr = JSON.stringify({
    goals: userContext.goals,
    dailyTasks: userContext.daily?.tasks || [],
    reflection: userContext.daily?.todayReflection || null
  });
  const goalsTokens = estimateTokens(goalsStr);

  // Momentum & Calendar data (New section) - includes detailed check-ins
  const momentumStr = JSON.stringify({
    momentumStats: userContext.momentumStats, // Now includes todayCheckins and recentCheckins arrays
    todayTasks: userContext.dailyActivity.todayTasks,
    upcomingConsultations: userContext.consultations.upcoming,
    returnedExercises: userContext.exercises.all.filter(e => e.status === 'returned'),
  });
  const momentumTokens = estimateTokens(momentumStr);

  // Base context (user profile + timestamps + prompts)
  const baseStr = JSON.stringify({
    user: userContext.user,
    currentDate: userContext.currentDate,
    currentDateTime: userContext.currentDateTime
  });
  const baseTokens = estimateTokens(baseStr) + 5000; // +5k for static prompts

  // Detailed University Breakdown
  let universityBreakdown = undefined;
  if (userContext.university && userContext.university.assignedYears && userContext.university.overallProgress) {
    const overallProgressTokens = estimateTokens(JSON.stringify(userContext.university.overallProgress));
    const yearsBreakdown = userContext.university.assignedYears.map(year => {
      const yearBaseTokens = estimateTokens(JSON.stringify({ title: year.title, description: year.description, grades: year.grades }));
      let totalYearTokens = yearBaseTokens;

      const trimestersBreakdown = year.trimesters.map(trimester => {
        const trimesterBaseTokens = estimateTokens(JSON.stringify({ title: trimester.title }));
        let totalTrimesterTokens = trimesterBaseTokens;

        const modulesBreakdown = trimester.modules.map(module => {
          const moduleBaseTokens = estimateTokens(JSON.stringify({ title: module.title }));
          let totalModuleTokens = moduleBaseTokens;

          const lessonsBreakdown = module.lessons.map(lesson => {
            const lessonTokens = estimateTokens(JSON.stringify(lesson));
            totalModuleTokens += lessonTokens;
            return {
              lessonTitle: lesson.title,
              tokens: lessonTokens,
            };
          });

          totalModuleTokens += lessonsBreakdown.length * 50; // Approximate tokens for lesson structure itself

          return {
            moduleTitle: module.title,
            totalModuleTokens,
            moduleBase: moduleBaseTokens,
            lessons: lessonsBreakdown,
          };
        });

        totalTrimesterTokens += modulesBreakdown.length * 75; // Approximate tokens for module structure

        return {
          trimesterTitle: trimester.title,
          totalTrimesterTokens,
          trimesterBase: trimesterBaseTokens,
          modules: modulesBreakdown,
        };
      });

      totalYearTokens += trimestersBreakdown.reduce((sum, t) => sum + t.totalTrimesterTokens, 0) + trimestersBreakdown.length * 100; // Approximate tokens for trimester structure

      return {
        yearTitle: year.title,
        totalYearTokens,
        yearBase: yearBaseTokens,
        trimesters: trimestersBreakdown,
      };
    });

    universityBreakdown = {
      overallProgress: overallProgressTokens,
      years: yearsBreakdown,
    };
  }


  // Knowledge Base tokens (for CLIENT - mirrors consultant implementation)
  const knowledgeBaseTokens = userContext.knowledgeBase
    ? estimateTokens(JSON.stringify(userContext.knowledgeBase))
    : 0;

  return {
    financeData: financeTokens,
    exercises: exercisesTokens,
    library: libraryTokens,
    university: universityTokens,
    consultations: consultationsTokens,
    goals: goalsTokens,
    momentum: momentumTokens,
    knowledgeBase: knowledgeBaseTokens,
    base: baseTokens,
    universityBreakdown
  };
}

// Cache per le keys del SuperAdmin (evita query ripetute)
let superAdminGeminiKeysCache: { keys: string[]; enabled: boolean; fetchedAt: number } | null = null;
const SUPERADMIN_GEMINI_CACHE_TTL = 60000; // 1 minuto

async function getSuperAdminGeminiKeys(): Promise<{ keys: string[]; enabled: boolean } | null> {
  // Check cache
  if (superAdminGeminiKeysCache && Date.now() - superAdminGeminiKeysCache.fetchedAt < SUPERADMIN_GEMINI_CACHE_TTL) {
    return { keys: superAdminGeminiKeysCache.keys, enabled: superAdminGeminiKeysCache.enabled };
  }
  
  try {
    const config = await db.select().from(superadminGeminiConfig).limit(1);
    if (!config.length || !config[0].enabled) {
      superAdminGeminiKeysCache = { keys: [], enabled: false, fetchedAt: Date.now() };
      return null;
    }
    
    // Decrypt the keys
    const decryptedKeysJson = decrypt(config[0].apiKeysEncrypted);
    const keys = JSON.parse(decryptedKeysJson) as string[];
    
    superAdminGeminiKeysCache = { keys, enabled: true, fetchedAt: Date.now() };
    return { keys, enabled: true };
  } catch (error) {
    console.error("[AI-SERVICE] Error fetching SuperAdmin Gemini keys:", error);
    return null;
  }
}

// Get current API key from user's rotation array or SuperAdmin config (async version)
async function getCurrentApiKeyAsync(
  user: { 
    geminiApiKeys: string[] | null; 
    geminiApiKeyIndex: number | null;
    useSuperadminGemini?: boolean | null;
  },
  superAdminKeys?: string[] | null
): Promise<{ apiKey: string; source: 'superadmin' | 'user' | 'env' }> {
  
  // Priority 1: SuperAdmin keys (if user opted in and keys available)
  if (user.useSuperadminGemini !== false && superAdminKeys && superAdminKeys.length > 0) {
    // Use random rotation for SuperAdmin keys
    const index = Math.floor(Math.random() * superAdminKeys.length);
    return { apiKey: superAdminKeys[index], source: 'superadmin' };
  }
  
  // Priority 2: User's own keys
  const apiKeys = user.geminiApiKeys || [];
  const currentIndex = user.geminiApiKeyIndex || 0;
  
  if (apiKeys.length > 0) {
    const validIndex = currentIndex % apiKeys.length;
    return { apiKey: apiKeys[validIndex], source: 'user' };
  }
  
  // Priority 3: Environment variable fallback
  const defaultKey = process.env.GEMINI_API_KEY || "";
  if (!defaultKey) {
    throw new Error("API_KEY_MISSING");
  }
  return { apiKey: defaultKey, source: 'env' };
}

// Keep backward compatible sync version
function getCurrentApiKey(user: { geminiApiKeys: string[] | null; geminiApiKeyIndex: number | null }): string {
  const apiKeys = user.geminiApiKeys || [];
  const currentIndex = user.geminiApiKeyIndex || 0;

  if (apiKeys.length > 0) {
    const validIndex = currentIndex % apiKeys.length;
    return apiKeys[validIndex];
  }

  const defaultKey = process.env.GEMINI_API_KEY || "";
  if (!defaultKey) {
    throw new Error("API_KEY_MISSING");
  }
  return defaultKey;
}

// Create AI instance with user-specific or default API key
function getAIInstance(apiKey: string): GoogleGenAI {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
}

// Rotate to next API key in the user's array (atomic operation)
async function rotateApiKey(userId: string, apiKeysLength: number): Promise<void> {
  if (apiKeysLength === 0) return; // No rotation needed if no API keys

  // Atomic SQL update: increment the index and wrap around using modulo
  // This prevents race conditions when multiple messages arrive concurrently
  await db.execute(
    sql`UPDATE users
        SET gemini_api_key_index = (COALESCE(gemini_api_key_index, 0) + 1) % ${apiKeysLength}
        WHERE id = ${userId}`
  );
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PageContext {
  pageType: "library_document" | "university_lesson" | "exercise" | "course" | "dashboard" | "other";
  resourceId?: string;
  resourceTitle?: string;
  resourceContent?: string;
  additionalContext?: {
    categoryName?: string;
    level?: string;
    estimatedDuration?: number;
    exerciseCategory?: string;
    exerciseType?: string;
    status?: string;
    dueDate?: string;
  };
}

export interface ChatRequest {
  clientId: string;
  message: string;
  conversationId?: string;
  mode: AIMode;
  consultantType?: ConsultantType;
  pageContext?: PageContext;
  focusedDocument?: { id: string; title: string; category: string };
  // Email Condivisa: Pass active profile role instead of relying on DB lookup
  userRole?: 'consultant' | 'client';
  // Email Condivisa: Pass consultant ID from active profile for mixed-role users
  activeConsultantId?: string;
  // Agent context: Use selected WhatsApp agent as AI persona
  agentId?: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  message: string;
  status: "processing" | "completed" | "error";
  tokensUsed?: number;
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
}

export interface ChatStreamChunk {
  type: "start" | "delta" | "complete" | "error" | "retry" | "heartbeat";
  conversationId: string;
  messageId?: string;
  content?: string;
  provider?: AiProviderMetadata;
  attempt?: number;
  maxAttempts?: number;
  delayMs?: number;
  nextRetryAt?: Date;
  message?: string;
  remainingMs?: number;
  usageMetadata?: GeminiUsageMetadata;
  suggestedActions?: Array<{
    type: string;
    label: string;
    data?: any;
  }>;
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const { clientId, message, conversationId, mode, consultantType, pageContext, userRole, activeConsultantId } = request;

  // Verify user exists (role already verified by middleware - supports Email Condivisa profiles)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  if (!user) {
    throw new Error("Utente non trovato");
  }

  // Email Condivisa: Use passed role/consultantId from active profile, fallback to DB values
  // This is critical for mixed-role users (consultants who are also clients of another consultant)
  const effectiveRole = userRole || (user.role as 'consultant' | 'client');
  const effectiveConsultantId = activeConsultantId || user.consultantId || clientId;
  
  // Extract consultantId (from active profile or user.consultantId or fallback to clientId)
  const consultantId = effectiveConsultantId;

  // Get AI provider using 3-tier priority system (Vertex AI client -> Vertex AI admin -> Google AI Studio)
  let aiProviderResult: AiProviderResult;
  try {
    aiProviderResult = await getAIProvider(clientId, consultantId);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING" || error.message.includes("No Gemini API key available")) {
      throw new Error("API Key Gemini mancante. Per favore, aggiungi la tua API Key personale nel profilo.");
    }
    throw error;
  }

  // Detect intent from message and build user context with smart filtering
  const { detectIntent } = await import('./ai-context-builder');
  const intent = detectIntent(message);
  
  // 🔍 FILE SEARCH: Check if consultant has FileSearchStore with ACTUAL DOCUMENTS
  const consultantIdForFileSearch = effectiveConsultantId;
  const { storeNames: fileSearchStoreNames, breakdown: fileSearchBreakdown } = await fileSearchService.getStoreBreakdownForGeneration(
    clientId,
    effectiveRole,
    consultantIdForFileSearch
  );
  // FIX: Only consider File Search active if stores have actual documents
  const totalDocsInStores = fileSearchBreakdown.reduce((sum, store) => sum + store.totalDocs, 0);
  
  // Check if client has File Search disabled by consultant
  const clientFileSearchEnabled = user.fileSearchEnabled !== false; // Default to true if null/undefined
  
  let hasFileSearch = fileSearchStoreNames.length > 0 && totalDocsInStores > 0 && clientFileSearchEnabled;
  
  if (!clientFileSearchEnabled) {
    console.log(`🚫 [FileSearch] File Search DISABLED for client ${clientId} by consultant - using traditional context`);
  } else if (fileSearchStoreNames.length > 0 && totalDocsInStores === 0) {
    console.log(`⚠️ [FileSearch] Stores exist but are EMPTY (0 documents) - disabling File Search mode`);
  }
  
  // Build context with reduced data if File Search is available
  const userContext: UserContext = await buildUserContext(clientId, { 
    message, 
    intent, 
    pageContext, 
    focusedDocument,
    useFileSearch: hasFileSearch,
  });

  let conversation;
  let conversationHistory: ChatMessage[] = [];

  // Get or create conversation
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.clientId, clientId)
      ))
      .limit(1);

    if (!existing) {
      throw new Error("Conversazione non trovata");
    }

    conversation = existing;

    // Get conversation history
    const history = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);

    conversationHistory = history.map((msg: any) => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }));
  } else {
    // Create new conversation
    const [newConversation] = await db
      .insert(aiConversations)
      .values({
        clientId,
        mode,
        consultantType: consultantType || null,
        title: message.substring(0, 50), // Use first 50 chars as title
        isActive: true,
      })
      .returning();

    conversation = newConversation;
  }

  // Save user message with status='completed'
  await db.insert(aiMessages).values({
    conversationId: conversation.id,
    role: "user",
    content: message,
    status: "completed",
    contextSnapshot: userContext as any,
  });

  try {
    let enhancedMessage = message;
    const messageLower = message.toLowerCase();

    // Check if exercises are indexed in File Search before deciding to scrape
    let exercisesIndexedInFileSearch = false;
    if (hasFileSearch && userContext.exercises.all.length > 0) {
      // Check how many exercises are indexed in File Search
      // FIX: Use exerciseId (original exercise ID) instead of id (assignment ID) for File Search lookup
      const exerciseIds = userContext.exercises.all.map(e => e.exerciseId).filter(Boolean);
      let indexedCount = 0;
      for (const exerciseId of exerciseIds.slice(0, 10)) { // Check first 10 max
        const isIndexed = await fileSearchService.isDocumentIndexed('exercise', exerciseId);
        if (isIndexed) indexedCount++;
      }
      // Consider exercises indexed if at least 50% are in File Search
      exercisesIndexedInFileSearch = indexedCount >= Math.min(5, exerciseIds.length * 0.5);
      console.log(`🔍 [FileSearch] Exercises indexed check: ${indexedCount}/${Math.min(10, exerciseIds.length)} checked, using FileSearch: ${exercisesIndexedInFileSearch}`);
    }

    // Load exercise content ONLY if NOT indexed in File Search
    if (userContext.exercises.all.length > 0 && !exercisesIndexedInFileSearch) {
      console.log('📚 Loading exercise content - exercises NOT in File Search, need full Google Docs access...');

      // Try to find which exercise(s) the user is referring to
      const matchedExercises = userContext.exercises.all.filter(exercise => {
        // Check if exercise title is mentioned in the message
        if (exercise.title && messageLower.includes(exercise.title.toLowerCase())) {
          return true;
        }
        // If message mentions a status, include relevant exercises
        if (messageLower.includes('pending') || messageLower.includes('pendente')) {
          return exercise.status === 'pending';
        }
        if (messageLower.includes('returned') || messageLower.includes('revisionato')) {
          return exercise.status === 'returned';
        }
        return false;
      });

      // Detect if user is asking for GENERAL/COMPLETE review
      const isGeneralReview = messageLower.match(/controllo.*general[ei]|analisi.*complet[oa]|tutti.*eserciz[io]|360|panoramic[oa]|tutti.*gli.*eserciz[io]|rivedi.*tutto|controlla.*tutto/i);

      // Determine scraping limit and exercise count based on specificity
      let contentLimit = 100000; // DEFAULT: SCRAPING TOTALE (100k = full content)
      let exercisesToScrape;

      if (isGeneralReview) {
        // CONTROLLO GENERALE: carica TUTTI gli esercizi pending + returned + in_progress
        exercisesToScrape = userContext.exercises.all
          .filter(e => e.status === 'pending' || e.status === 'in_progress' || e.status === 'returned')
          .slice(0, 15); // Max 15 esercizi per controllo generale
        contentLimit = 100000; // Scraping TOTALE per ogni esercizio
        console.log(`🔍 CONTROLLO GENERALE detected - loading ${exercisesToScrape.length} exercises with FULL CONTENT (100k limit each)`);
      } else if (matchedExercises.length === 1) {
        // Esercizio specifico singolo
        exercisesToScrape = matchedExercises;
        contentLimit = 100000; // SCRAPING TOTALE
        console.log('✅ Single specific exercise detected - FULL CONTENT (100k limit)');
      } else if (matchedExercises.length >= 2) {
        // Esercizi multipli specifici
        exercisesToScrape = matchedExercises.slice(0, 5);
        contentLimit = 100000; // SCRAPING TOTALE anche per multipli
        console.log(`📊 ${exercisesToScrape.length} specific exercises detected - FULL CONTENT (100k limit each)`);
      } else {
        // Query generica: usa filtro smart
        exercisesToScrape = userContext.exercises.all
          .filter(e => e.status === 'pending' || e.status === 'in_progress' || e.status === 'returned')
          .slice(0, 5); // Aumentato da 2 a 5
        contentLimit = 100000; // SCRAPING TOTALE
        console.log(`📋 Generic exercise query - loading ${exercisesToScrape.length} exercises with FULL CONTENT`);
      }

      if (exercisesToScrape.length > 0) {
        const exerciseUrls = exercisesToScrape
          .filter(e => e.workPlatform)
          .map(e => ({ url: e.workPlatform!, title: e.title, id: e.id }));

        if (exerciseUrls.length > 0) {
          console.log(`\n📥 Scraping ${exerciseUrls.length} exercise(s) with CACHE-AWARE logic:`);
          console.log(`   Content limit: ${contentLimit.toLocaleString()} chars (FULL CONTENT)`);
          console.log(`   Exercises: ${exerciseUrls.map(e => e.title).join(', ')}`);

          // Detect modification hints and update conversational context
          const modificationDetected = detectModificationHint(message);
          const mentionedIds = detectMentionedExercises(message, exercisesToScrape);
          updateConversationalContext(conversationId || 'no-conv', mentionedIds, modificationDetected);

          // Scrape with CACHE-AWARE logic
          const scrapingStartTime = performance.now();
          const scrapingResults = await Promise.all(
            exerciseUrls.map(async ({ url, title, id }) => {
              const exerciseStartTime = performance.now();
              
              // Check cache first
              const cached = getCachedExercise(url, id, conversationId || null);
              
              if (cached) {
                const exerciseTime = Math.round(performance.now() - exerciseStartTime);
                console.log(`   ✅ [CACHE HIT] "${title}" (age: ${cached.age}s, time: ${exerciseTime}ms)`);
                return {
                  url,
                  title,
                  content: cached.content,
                  source: 'cache',
                  age: cached.age,
                  time: exerciseTime
                };
              }
              
              // Cache miss → scrape
              console.log(`   🔄 [CACHE MISS] "${title}" - scraping from Google Docs...`);
              try {
                const scraped = await scrapeGoogleDoc(url, contentLimit);
                
                if (scraped.success && scraped.content) {
                  // Save in cache
                  setCachedExercise(url, id, title, scraped.content, conversationId || null);
                  const exerciseTime = Math.round(performance.now() - exerciseStartTime);
                  console.log(`   ✅ [SCRAPED] "${title}" (${scraped.content.length.toLocaleString()} chars, time: ${exerciseTime}ms)`);
                  return {
                    url,
                    title,
                    content: scraped.content,
                    source: 'fresh',
                    age: 0,
                    time: exerciseTime
                  };
                }
                
                // If scraping fails, use stale cache as fallback
                const stale = getStaleCachedExercise(url);
                if (stale) {
                  const exerciseTime = Math.round(performance.now() - exerciseStartTime);
                  console.log(`   ⚠️  [STALE CACHE] "${title}" - scraping failed, using stale cache (age: ${stale.age}s)`);
                  return {
                    url,
                    title,
                    content: stale.content,
                    source: 'stale-cache',
                    age: stale.age,
                    time: exerciseTime
                  };
                }
                
                return null;
              } catch (error: any) {
                console.error(`   ❌ [ERROR] "${title}": ${error.message}`);
                
                // Try stale cache as fallback
                const stale = getStaleCachedExercise(url);
                if (stale) {
                  const exerciseTime = Math.round(performance.now() - exerciseStartTime);
                  console.log(`   ⚠️  [STALE CACHE FALLBACK] "${title}" (age: ${stale.age}s)`);
                  return {
                    url,
                    title,
                    content: stale.content,
                    source: 'stale-cache',
                    age: stale.age,
                    time: exerciseTime
                  };
                }
                
                return null;
              }
            })
          );

          const scrapingTotalTime = Math.round(performance.now() - scrapingStartTime);
          
          // Filter valid results
          const validResults = scrapingResults.filter(r => r !== null);

          // Filter out error messages from Google Docs/Sheets
          const cleanResults = validResults.filter(result => {
            const contentLower = result!.content.toLowerCase();
            const hasErrorMessages =
              contentLower.includes("javascript isn't enabled") ||
              contentLower.includes("javascript is not enabled") ||
              contentLower.includes("browser is not supported") ||
              contentLower.includes("enable javascript") ||
              (contentLower.includes("error") && result!.content.length < 200);
            return !hasErrorMessages;
          });

          // Format results with source labels
          const scrapedData = cleanResults
            .map(result => {
              const sourceLabel = result!.source === 'cache' 
                ? `✅ Cache (${result!.age}s ago)`
                : result!.source === 'stale-cache'
                ? `⚠️ Stale Cache (${result!.age}s ago)`
                : `🔄 Fresh`;
              
              const charCount = result!.content.length;
              console.log(`   📄 "${result!.title}": ${charCount.toLocaleString()} chars [${sourceLabel}]`);
              
              return `\n\n[Contenuto dell'esercizio "${result!.title}": ${result!.url}]\n[Fonte: ${sourceLabel}]\n${result!.content}\n[Fine contenuto]`;
            })
            .join("\n");

          if (scrapedData) {
            enhancedMessage = `${message}\n${scrapedData}`;
            const totalChars = cleanResults.reduce((sum, r) => sum + (r!.content?.length || 0), 0);
            const cacheHits = cleanResults.filter(r => r!.source === 'cache').length;
            const freshScrapes = cleanResults.filter(r => r!.source === 'fresh').length;
            const staleCacheHits = cleanResults.filter(r => r!.source === 'stale-cache').length;
            
            console.log(`\n✅ Successfully loaded ${cleanResults.length} exercise(s):`);
            console.log(`   📊 Total content: ${totalChars.toLocaleString()} chars`);
            console.log(`   ⚡ Cache hits: ${cacheHits}, Fresh scrapes: ${freshScrapes}, Stale cache: ${staleCacheHits}`);
            console.log(`   ⏱️  Total scraping time: ${scrapingTotalTime}ms`);
            console.log(`   🗑️  Filtered out: ${validResults.length - cleanResults.length} error responses`);
            
            // Log cache statistics
            logCacheStats();
          } else if (exerciseUrls.length > 0) {
            console.log(`⚠️ Attempted to scrape ${exerciseUrls.length} exercise(s), but all returned errors or invalid content`);
          }
        }
      }
    }

    // Also extract and scrape any URLs directly in the message (limited to max 3 URLs)
    const urls = extractUrls(message).slice(0, 3);

    if (urls.length > 0) {
      console.log(`Found ${urls.length} URL(s) in message, scraping with 100k limit...`);
      const scrapedContents = await scrapeMultipleUrls(urls, 100000);

      // Add scraped content to the message (full content, no truncation)
      const scrapedData = scrapedContents
        .filter(content => content.success && content.content)
        .map(content => {
          const urlType = isGoogleSheetsUrl(content.url) ? "Google Sheets" : "web page";
          const charCount = content.content!.length;
          console.log(`   📄 ${urlType}: ${charCount.toLocaleString()} chars (NO TRUNCATION)`);
          return `\n\n[Contenuto da ${urlType}: ${content.url}]\n${content.content}\n[Fine contenuto]`;
        })
        .join("\n");

      if (scrapedData) {
        enhancedMessage = `${message}\n${scrapedData}`;
        const totalChars = scrapedContents.filter(c => c.success && c.content).reduce((sum, c) => sum + (c.content?.length || 0), 0);
        console.log(`✅ Added ${scrapedContents.filter(c => c.success).length} scraped URL(s) to message (${totalChars.toLocaleString()} total chars)`);
      }
    }

    // Build set of indexed knowledge doc IDs for selective fallback
    // Include both client-owned and consultant-owned KB docs that are indexed
    const indexedKnowledgeDocIds = new Set<string>();
    if (hasFileSearch && userContext.knowledgeBase) {
      try {
        // Use simple query with only clientId to avoid complex or() conditions
        console.log(`🔍 [KB Fallback Debug] Querying indexed docs for clientId: ${clientId}, consultantId: ${consultantId}`);
        
        // Query for client-owned KB docs
        const clientKbDocs = await db.query.fileSearchDocuments.findMany({
          where: and(
            eq(fileSearchDocuments.sourceType, 'knowledge_base'),
            eq(fileSearchDocuments.clientId, clientId),
            eq(fileSearchDocuments.status, 'indexed')
          ),
          columns: { sourceId: true }
        });
        
        // Query for consultant-owned KB docs if consultantId is different
        let consultantKbDocs: { sourceId: string | null }[] = [];
        if (consultantId && consultantId !== clientId) {
          consultantKbDocs = await db.query.fileSearchDocuments.findMany({
            where: and(
              eq(fileSearchDocuments.sourceType, 'knowledge_base'),
              eq(fileSearchDocuments.consultantId, consultantId),
              eq(fileSearchDocuments.status, 'indexed')
            ),
            columns: { sourceId: true }
          });
        }
        
        // Combine results
        const indexedKbDocs = [...clientKbDocs, ...consultantKbDocs];
        
        for (const doc of indexedKbDocs) {
          if (doc.sourceId) {
            // Handle both regular docs and chunked docs (extract base ID from chunk_X suffix)
            const baseId = doc.sourceId.includes('_chunk_') 
              ? doc.sourceId.split('_chunk_')[0] 
              : doc.sourceId;
            indexedKnowledgeDocIds.add(baseId);
          }
        }
        console.log(`📚 [KB Fallback] ${indexedKnowledgeDocIds.size} KB docs indexed, ${userContext.knowledgeBase.documents.length - indexedKnowledgeDocIds.size} will be in prompt`);
      } catch (kbError) {
        console.error(`⚠️ [KB Fallback] Error querying indexed docs, skipping fallback:`, kbError);
        // Continue without fallback - all KB docs will go to File Search
      }
    }
    
    // Build system prompt (with hasFileSearch flag to omit KB content when using RAG)
    const systemPrompt = buildSystemPrompt(mode, consultantType || null, userContext, pageContext, { hasFileSearch: hasFileSearch, indexedKnowledgeDocIds });

    // Calculate detailed token breakdown by section
    const breakdown = calculateTokenBreakdown(userContext, intent);

    // Log token usage estimation for monitoring
    const systemPromptTokens = estimateTokens(systemPrompt);
    const userMessageTokens = estimateTokens(enhancedMessage);
    const historyTokens = conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const totalEstimatedTokens = systemPromptTokens + userMessageTokens + historyTokens;
    
    // Determine if File Search is active - MUST have actual documents
    const hasActiveFileSearch = hasFileSearch; // Uses the already-computed value that checks totalDocsInStores > 0

    console.log(`\n📊 Token Usage Estimation (Intent: ${intent}):`);
    console.log(`  - System Prompt: ~${systemPromptTokens.toLocaleString()} tokens`);
    console.log(`  - User Message: ~${userMessageTokens.toLocaleString()} tokens`);
    console.log(`  - Conversation History: ~${historyTokens.toLocaleString()} tokens`);
    console.log(`  - Total Estimated: ~${totalEstimatedTokens.toLocaleString()} tokens`);
    console.log(`  - File Search Mode: ${hasActiveFileSearch ? '✅ ACTIVE (RAG via stores)' : '❌ OFF (full content in prompt)'}`);

    // Log token breakdown with File Search awareness (pass actual indexed docs breakdown)
    logTokenBreakdown(breakdown, systemPromptTokens, hasActiveFileSearch, fileSearchBreakdown);

    // Prepare messages for Gemini
    const geminiMessages = [
      ...conversationHistory,
      { role: "user" as const, content: enhancedMessage },
    ];

    // Call Gemini API with unified retry logic
    const retryContext: AiRetryContext = {
      conversationId: conversation.id,
      provider: GOOGLE_AI_STUDIO_PROVIDER,
      emit: (event) => {
        // Log structured telemetry for non-streaming calls
        if (event.type === 'retry') {
          console.log(`⏳ [RETRY] Attempt ${event.attempt}/${event.maxAttempts}, delay: ${event.delayMs}ms, next retry: ${event.nextRetryAt.toISOString()}, provider: ${event.provider.name}, message: ${event.message}`);
        } else if (event.type === 'heartbeat') {
          console.log(`💓 [HEARTBEAT] Remaining: ${event.remainingMs}ms, provider: ${event.provider.name}`);
        }
      },
    };

    // Build FileSearch tool from stores already fetched above (only if stores have actual documents)
    const fileSearchTool = hasFileSearch ? fileSearchService.buildFileSearchTool(fileSearchStoreNames) : null;
    
    // 📊 LOG DISTINTIVO: FILE SEARCH vs RAG CLASSICO
    const ragTokens = breakdown.exercises + breakdown.library + breakdown.consultations + breakdown.knowledgeBase;
    const potentialSavings = hasFileSearch ? ragTokens : 0;
    
    console.log(`\n${'═'.repeat(70)}`);
    if (hasFileSearch) {
      console.log(`🔍 AI MODE: FILE SEARCH SEMANTIC (Gemini RAG)`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores disponibili: ${fileSearchStoreNames.length}`);
      fileSearchStoreNames.forEach((name, i) => console.log(`      ${i + 1}. ${name}`));
      logFileSearchBreakdown(fileSearchBreakdown);
      console.log(`   ✅ Tool fileSearch: ATTIVO`);
      console.log(`   📄 Il modello cercherà semanticamente nei documenti indicizzati`);
      console.log(`   💰 RISPARMIO TOKENS: ~${ragTokens.toLocaleString()} tokens (esercizi+library+consultazioni+KB)`);
      console.log(`   📉 System prompt ridotto: da ~${(systemPromptTokens + ragTokens).toLocaleString()} a ~${systemPromptTokens.toLocaleString()} tokens`);
    } else {
      console.log(`📚 AI MODE: RAG CLASSICO (Context Injection)`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores FileSearch: NESSUNO`);
      console.log(`   ❌ Tool fileSearch: NON ATTIVO`);
      console.log(`   📄 Tutto il contesto viene iniettato nel system prompt (~${systemPromptTokens.toLocaleString()} tokens)`);
      console.log(`   💡 TIP: Sincronizza i documenti per attivare File Search e ridurre i costi!`);
    }
    console.log(`${'═'.repeat(70)}\n`);

    // Select model dynamically - this section uses Google AI Studio directly
    const { model: clientModel, useThinking: clientUseThinking } = getTextChatModel('Google AI Studio');
    console.log(`[AI] Using model: ${clientModel} with thinking_level: ${clientUseThinking ? GEMINI_3_THINKING_LEVEL : 'N/A (legacy)'}`);
    console.log(`[AI] Provider: Google AI Studio -> ${clientUseThinking ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash'}`);

    const response = await retryWithBackoff(
      async (ctx: OperationAttemptContext) => {
        return await ai.models.generateContent({
          model: clientModel,
          contents: geminiMessages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          })),
          config: {
            systemInstruction: systemPrompt,
            ...(clientUseThinking && {
              thinkingConfig: {
                thinkingLevel: GEMINI_3_THINKING_LEVEL
              }
            }),
          },
          ...(fileSearchTool && { tools: [fileSearchTool] }),
        });
      },
      retryContext
    );

    let assistantMessage = response.text || "Mi dispiace, non sono riuscito a generare una risposta.";

    // 📊 LOG CITAZIONI FILE SEARCH (se usato)
    if (hasFileSearch) {
      const citations = fileSearchService.parseCitations(response);
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🔍 FILE SEARCH RESPONSE ANALYSIS`);
      console.log(`${'─'.repeat(70)}`);
      if (citations.length > 0) {
        console.log(`   ✅ Gemini HA USATO File Search - ${citations.length} citazioni trovate:`);
        citations.forEach((c, i) => {
          console.log(`      ${i + 1}. "${c.sourceTitle}" ${c.startIndex !== undefined ? `[${c.startIndex}-${c.endIndex}]` : ''}`);
          if (c.content) console.log(`         └─ "${c.content.substring(0, 100)}..."`);
        });
      } else {
        console.log(`   ⚠️  Gemini NON ha usato File Search per questa risposta`);
        console.log(`   📄 La risposta è basata sul context injection (RAG classico)`);
      }
      console.log(`${'─'.repeat(70)}\n`);
    }

    // Extract suggested actions before saving
    const suggestedActions = extractSuggestedActions(assistantMessage, userContext);

    // Remove [ACTIONS] block from the message to keep it clean
    assistantMessage = assistantMessage.replace(/\[ACTIONS\]\s*\{[\s\S]*?\}\s*\[\/ACTIONS\]/g, '').trim();

    // Save assistant message with completed status
    const [savedMessage] = await db.insert(aiMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: assistantMessage,
        status: "completed",
        tokensUsed: null,
        metadata: suggestedActions.length > 0 ? { suggestedActions } : null,
      })
      .returning();

    // Track CLIENT knowledge base usage - increment usage count for all documents and APIs used in context
    if (userContext.knowledgeBase) {
      const documentIds = userContext.knowledgeBase.documents.map((d: any) => d.id);
      const apiIds = userContext.knowledgeBase.apiData
        .filter((a: any) => a.id)
        .map((a: any) => a.id as string);
      
      // Track usage asynchronously (don't block response)
      Promise.all([
        documentIds.length > 0 ? trackClientDocumentUsage(documentIds) : Promise.resolve(),
        apiIds.length > 0 ? trackClientApiUsage(apiIds) : Promise.resolve(),
      ]).catch(err => {
        console.error('❌ [Client Knowledge Tracking] Failed to track usage:', err);
      });
    }

    // Parallelize conversation and preferences updates
    await Promise.all([
      // Update conversation last message time
      db.update(aiConversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, conversation.id)),

      // Update user preferences last interaction
      db.insert(aiUserPreferences)
        .values({
          clientId,
          preferredMode: mode,
          preferredConsultantType: consultantType || 'finanziario',
          lastInteraction: new Date(),
        })
        .onConflictDoUpdate({
          target: aiUserPreferences.clientId,
          set: {
            preferredMode: mode,
            preferredConsultantType: consultantType || 'finanziario',
            lastInteraction: new Date(),
            updatedAt: new Date(),
          },
        })
    ]);

    console.log(`✅ AI processing completed for message ${savedMessage.id}`);

    return {
      conversationId: conversation.id,
      messageId: savedMessage.id,
      message: assistantMessage,
      status: "completed" as const,
      suggestedActions,
    };
  } catch (error: any) {
    console.error("❌ Errore nel processing AI:", error);

    // Save error message
    const [errorMessage] = await db.insert(aiMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: "Mi dispiace, si è verificato un errore. Riprova.",
        status: "error",
      })
      .returning();

    // Parallelize error updates
    await Promise.all([
      // Update conversation timestamps even on error
      db.update(aiConversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, conversation.id)),

      // Update user preferences even on error
      db.insert(aiUserPreferences)
        .values({
          clientId,
          preferredMode: mode,
          preferredConsultantType: consultantType || 'finanziario',
          lastInteraction: new Date(),
        })
        .onConflictDoUpdate({
          target: aiUserPreferences.clientId,
          set: {
            preferredMode: mode,
            preferredConsultantType: consultantType || 'finanziario',
            lastInteraction: new Date(),
            updatedAt: new Date(),
          },
        })
    ]);

    return {
      conversationId: conversation.id,
      messageId: errorMessage.id,
      message: "Mi dispiace, si è verificato un errore. Riprova.",
      status: "error" as const,
    };
  }
}

export async function* sendChatMessageStream(request: ChatRequest): AsyncGenerator<ChatStreamChunk> {
  const { clientId, message, conversationId, mode, consultantType, pageContext, focusedDocument, userRole, activeConsultantId, agentId } = request;

  // ========================================
  // AGENT CONTEXT: Fetch agent persona if agentId is provided
  // ========================================
  let agentContext = '';
  let agentConfig: typeof consultantWhatsappConfig.$inferSelect | null = null;
  
  if (agentId) {
    const [fetchedAgentConfig] = await db.select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentId))
      .limit(1);
    
    if (fetchedAgentConfig) {
      agentConfig = fetchedAgentConfig;
      console.log(`🤖 [Agent Context] Using agent "${agentConfig.agentName}" (${agentConfig.agentType}) for AI response`);
      
      agentContext = `
## Contesto Agente Attivo
Stai operando come l'agente "${agentConfig.agentName}".

### Personalità e Tono
- Tipo: ${agentConfig.agentType || 'general'}
- Personalità: ${agentConfig.aiPersonality || 'professional'}

### Informazioni Business
${agentConfig.businessName ? `- Nome Business: ${agentConfig.businessName}` : ''}
${agentConfig.businessDescription ? `- Descrizione: ${agentConfig.businessDescription}` : ''}
${agentConfig.whatWeDo ? `- Cosa Facciamo: ${agentConfig.whatWeDo}` : ''}
${agentConfig.whoWeHelp ? `- Chi Aiutiamo: ${agentConfig.whoWeHelp}` : ''}

### Istruzioni Specifiche
${agentConfig.agentInstructions || 'Nessuna istruzione specifica.'}

### REGOLA IMPORTANTE: Focus sull'Argomento
Sei specializzato negli argomenti relativi a questo agente ("${agentConfig.agentName}").
- Rispondi SOLO a domande pertinenti al tuo ruolo e competenze.
- Se l'utente chiede qualcosa fuori dal tuo ambito di competenza:
  1. Rispondi brevemente che questa domanda non rientra nelle tue competenze specifiche
  2. Suggerisci gentilmente di usare l'"Assistenza base" per domande generali o un altro agente appropriato
  3. Esempio: "Questa domanda riguarda [argomento X] che non rientra nelle mie competenze. Ti consiglio di provare con l'Assistenza base o con un agente specializzato in [argomento]."
- Non divagare su argomenti non pertinenti al tuo ruolo.
`;
    }
  }

  // ========================================
  // USER PREFERENCES CONTEXT: Fetch AI assistant preferences
  // ========================================
  let userPreferencesContext = '';
  try {
    const [prefs] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, clientId))
      .limit(1);
    
    // Also fetch consultant's default system instructions for clients
    let consultantDefaultInstructions: string | null = null;
    const [clientUser] = await db.select({ consultantId: users.consultantId })
      .from(users)
      .where(eq(users.id, clientId))
      .limit(1);
    
    if (clientUser?.consultantId) {
      const [consultantPrefs] = await db.select({ defaultSystemInstructions: aiAssistantPreferences.defaultSystemInstructions })
        .from(aiAssistantPreferences)
        .where(eq(aiAssistantPreferences.userId, clientUser.consultantId))
        .limit(1);
      consultantDefaultInstructions = consultantPrefs?.defaultSystemInstructions || null;
    }
    
    const writingStyleLabels: Record<string, string> = {
      default: 'Usa uno stile e tono predefiniti, naturali e bilanciati',
      professional: 'Sii cortese e preciso, mantieni un tono professionale',
      friendly: 'Sii espansivo e loquace, usa un tono amichevole e caloroso',
      direct: 'Sii diretto e incoraggiante, vai dritto al punto',
      eccentric: 'Sii vivace e fantasioso, usa un tono creativo e originale',
      efficient: 'Sii essenziale e semplice, rispondi in modo efficiente',
      nerd: 'Sii curioso e appassionato, approfondisci i dettagli tecnici',
      cynical: 'Sii critico e sarcastico, usa un tono ironico',
      custom: 'Segui le istruzioni personalizzate dell\'utente'
    };
    
    const responseLengthLabels: Record<string, string> = {
      short: 'Mantieni le risposte brevi (1-2 paragrafi)',
      balanced: 'Usa una lunghezza moderata',
      comprehensive: 'Fornisci risposte complete e dettagliate'
    };
    
    // Build preferences context with consultant's base instructions + client's overrides
    const baseInstructions = consultantDefaultInstructions 
      ? `\n## Istruzioni Base del Consulente\n${consultantDefaultInstructions}\n`
      : '';
    
    if (prefs) {
      userPreferencesContext = `${baseInstructions}
## Preferenze di Comunicazione dell'Utente
- Stile di Scrittura: ${writingStyleLabels[prefs.writingStyle] || 'Professionale'}
- Lunghezza Risposte: ${responseLengthLabels[prefs.responseLength] || 'Bilanciata'}
${prefs.customInstructions ? `- Istruzioni Personalizzate: ${prefs.customInstructions}` : ''}

IMPORTANTE: Rispetta queste preferenze in tutte le tue risposte.
`;
      console.log(`📝 [User Preferences] Applying preferences - Style: ${prefs.writingStyle}, Length: ${prefs.responseLength}${consultantDefaultInstructions ? ', with consultant base instructions' : ''}`);
    } else if (consultantDefaultInstructions) {
      userPreferencesContext = baseInstructions;
      console.log(`📝 [User Preferences] Applying consultant's default system instructions only`);
    }
  } catch (prefError) {
    console.log(`⚠️ [User Preferences] Could not fetch preferences:`, prefError);
  }

  // ========================================
  // PERFORMANCE TIMING TRACKING
  // ========================================
  const timings = {
    requestStart: performance.now(),
    contextBuildStart: 0,
    contextBuildEnd: 0,
    exerciseScrapingStart: 0,
    exerciseScrapingEnd: 0,
    promptBuildStart: 0,
    promptBuildEnd: 0,
    geminiCallStart: 0,
    geminiCallEnd: 0,
    totalEnd: 0,
  };

  // Verify user exists (role already verified by middleware - supports Email Condivisa profiles)
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  if (!user) {
    yield {
      type: "error",
      conversationId: conversationId || "",
      error: "Utente non trovato",
      content: "Utente non trovato",
    };
    return;
  }

  // Declare aiProviderResult outside try block so finally can access it
  let aiProviderResult: AiProviderResult | undefined;
  
  // Initialize timing variables in scope for final log
  let contextBuildTime = 0;
  let exerciseScrapingTime = 0;
  let promptBuildTime = 0;
  let geminiCallTime = 0;

  let conversation;
  let conversationHistory: ChatMessage[] = []; // Inizializza subito come array vuoto

  try {
    // Email Condivisa: Use passed role/consultantId from active profile, fallback to DB values
    // This is critical for mixed-role users (consultants who are also clients of another consultant)
    const effectiveRole = userRole || (user.role as 'consultant' | 'client');
    const effectiveConsultantId = activeConsultantId || user.consultantId || clientId;
    
    // Extract consultantId (from active profile or user.consultantId or fallback to clientId)
    const consultantId = effectiveConsultantId;

    // 🔍 FILE SEARCH: Check if consultant has FileSearchStore with ACTUAL DOCUMENTS
    // File Search ONLY works with Google AI Studio (@google/genai), NOT Vertex AI
    const consultantIdForFileSearch = effectiveConsultantId;
    const { storeNames: fileSearchStoreNames, breakdown: fileSearchBreakdown } = await fileSearchService.getStoreBreakdownForGeneration(
      clientId,
      effectiveRole,
      consultantIdForFileSearch
    );
    // FIX: Only consider File Search active if stores have actual documents
    const totalDocsInStores = fileSearchBreakdown.reduce((sum, store) => sum + store.totalDocs, 0);
    
    // Check if client has File Search disabled by consultant
    const clientFileSearchEnabledStreaming = user.fileSearchEnabled !== false; // Default to true if null/undefined
    
    const hasFileSearch = fileSearchStoreNames.length > 0 && totalDocsInStores > 0 && clientFileSearchEnabledStreaming;
    
    if (!clientFileSearchEnabledStreaming) {
      console.log(`🚫 [FileSearch] File Search DISABLED for client ${clientId} by consultant - using traditional context`);
    } else if (fileSearchStoreNames.length > 0 && totalDocsInStores === 0) {
      console.log(`⚠️ [FileSearch] Stores exist but are EMPTY (0 documents) - disabling File Search mode`);
    }

    // Get AI provider - Use Google AI Studio if File Search is active, otherwise 3-tier system
    let aiClient: any;
    let providerMetadata: AiProviderMetadata;
    
    if (hasFileSearch) {
      // 🔍 FILE SEARCH MODE: Force Google AI Studio (Vertex AI doesn't support File Search)
      const fileSearchProvider = await getGoogleAIStudioClientForFileSearch(consultantIdForFileSearch);
      if (fileSearchProvider) {
        aiClient = fileSearchProvider.client;
        providerMetadata = fileSearchProvider.metadata;
        aiProviderResult = { client: aiClient, metadata: providerMetadata, source: 'google' };
      } else {
        // Fallback to normal provider if Google AI Studio not available
        console.log(`⚠️ File Search stores found but Google AI Studio not available, falling back to normal provider`);
        aiProviderResult = await getAIProvider(clientId, consultantId);
        aiClient = aiProviderResult.client;
        providerMetadata = aiProviderResult.metadata;
      }
    } else {
      // Normal 3-tier priority system (Vertex AI client -> Vertex AI admin -> Google AI Studio)
      aiProviderResult = await getAIProvider(clientId, consultantId);
      aiClient = aiProviderResult.client;
      providerMetadata = aiProviderResult.metadata;
    }

    // Detect intent from message and build user context with smart filtering
    timings.contextBuildStart = performance.now();
    const { detectIntent } = await import('./ai-context-builder');
    const intent = detectIntent(message);
    
    // Build context with reduced data if File Search is available
    const userContext: UserContext = await buildUserContext(clientId, { 
      message, 
      intent, 
      pageContext, 
      focusedDocument,
      useFileSearch: hasFileSearch, // Skip heavy content when File Search can retrieve it
    });
    timings.contextBuildEnd = performance.now();

    contextBuildTime = Math.round(timings.contextBuildEnd - timings.contextBuildStart);
    console.log(`⏱️  [TIMING] Context building: ${contextBuildTime}ms`);
    // Get or create conversation
    if (conversationId) {
      const [existing] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.clientId, clientId)
        ))
        .limit(1);

      if (!existing) {
        yield {
          type: "error",
          conversationId: conversationId || "",
          error: "Conversazione non trovata",
          content: "Conversazione non trovata",
        };
        return;
      }

      conversation = existing;

      // Get conversation history
      const history = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(aiMessages.createdAt);

      conversationHistory = history.map((msg: any) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));
    } else {
      // Create new conversation
      const [newConversation] = await db
        .insert(aiConversations)
        .values({
          clientId,
          agentId: agentId || null, // Save agent ID if provided, null for base assistance
          mode,
          consultantType: consultantType || null,
          title: message.substring(0, 50),
          isActive: true,
        })
        .returning();

      conversation = newConversation;
    }

    // Yield start event
    yield {
      type: "start",
      conversationId: conversation.id,
    };

    // Save user message with status='completed'
    await db.insert(aiMessages).values({
      conversationId: conversation.id,
      role: "user",
      content: message,
      status: "completed",
      contextSnapshot: userContext as any,
    });

    // ========================================
    // SMART EXERCISE SCRAPING WITH INTELLIGENT CACHE
    // ========================================
    timings.exerciseScrapingStart = performance.now();
    let enhancedMessage = message;
    const messageLower = message.toLowerCase();

    // Detect modification hints (fatto, aggiunto, modificato, etc.)
    const modificationHintDetected = detectModificationHint(message);
    if (modificationHintDetected) {
      console.log('🔔 [EXERCISE CACHE] Modification hint detected in message');
    }

    // Detect mentioned exercises for conversational context tracking
    const mentionedExerciseIds = detectMentionedExercises(message, userContext.exercises.all);
    
    // Update conversational context
    updateConversationalContext(conversation.id, mentionedExerciseIds, modificationHintDetected);

    // Check if exercises are indexed in File Search before deciding to scrape
    let exercisesIndexedInFileSearch = false;
    if (hasFileSearch && userContext.exercises.all.length > 0) {
      // FIX: Use exerciseId (original exercise ID) instead of id (assignment ID) for File Search lookup
      const exerciseIds = userContext.exercises.all.map(e => e.exerciseId).filter(Boolean);
      let indexedCount = 0;
      for (const exerciseId of exerciseIds.slice(0, 10)) {
        const isIndexed = await fileSearchService.isDocumentIndexed('exercise', exerciseId);
        if (isIndexed) indexedCount++;
      }
      exercisesIndexedInFileSearch = indexedCount >= Math.min(5, exerciseIds.length * 0.5);
      console.log(`🔍 [FileSearch] Exercises indexed check: ${indexedCount}/${Math.min(10, exerciseIds.length)} checked, using FileSearch: ${exercisesIndexedInFileSearch}`);
    }

    // Load exercise content ONLY if NOT indexed in File Search
    if (userContext.exercises.all.length > 0 && !exercisesIndexedInFileSearch) {
      console.log('📚 Loading exercise content - exercises NOT in File Search, need full Google Docs access...');

      // Try to find which exercise(s) the user is referring to
      const matchedExercises = userContext.exercises.all.filter(exercise => {
        // Check if exercise title is mentioned in the message
        if (exercise.title && messageLower.includes(exercise.title.toLowerCase())) {
          return true;
        }
        // If message mentions a status, include relevant exercises
        if (messageLower.includes('pending') || messageLower.includes('pendente')) {
          return exercise.status === 'pending';
        }
        if (messageLower.includes('returned') || messageLower.includes('revisionato')) {
          return exercise.status === 'returned';
        }
        return false;
      });

      // SEMPRE contenuto COMPLETO - nessun limite
      // L'AI deve avere accesso a tutto il contenuto dei Google Docs degli esercizi
      let contentLimit = Infinity; // NO LIMIT - sempre contenuto completo

      const exercisesToScrape = matchedExercises.length > 0
        ? matchedExercises.slice(0, 5) // Aumentato da 3 a 5
        : userContext.exercises.all
            .filter(e => e.status === 'pending' || e.status === 'in_progress' || e.status === 'returned')
            .slice(0, 5); // Aumentato da 2 a 5

      if (matchedExercises.length === 1) {
        console.log('✅ Single specific exercise detected - FULL CONTENT');
      } else if (matchedExercises.length >= 2) {
        console.log(`📊 ${matchedExercises.length} specific exercises detected - FULL CONTENT each`);
      } else {
        console.log('📋 Generic exercise query - FULL CONTENT (no limits)');
      }

      if (exercisesToScrape.length > 0) {
        const exercisesToLoad = exercisesToScrape.filter(e => e.workPlatform);

        if (exercisesToLoad.length > 0) {
          console.log(`Loading ${exercisesToLoad.length} exercise(s) with ${contentLimit === Infinity ? 'NO LIMIT' : contentLimit + ' char limit'}: ${exercisesToLoad.map(e => e.title).join(', ')}`);
          
          // Load exercises using cache-aware logic
          const loadedExercises = await Promise.all(
            exercisesToLoad.map(async (exercise) => {
              // Check cache first
              const cached = getCachedExercise(exercise.workPlatform!, exercise.id, conversation.id);
              
              if (cached) {
                // Cache hit - use cached content
                return {
                  success: true,
                  content: cached.content,
                  url: exercise.workPlatform!,
                  title: exercise.title,
                  source: 'cache',
                  age: cached.age,
                };
              }
              
              // Cache miss - scrape and store
              console.log(`🔄 [EXERCISE CACHE] MISS for "${exercise.title}" - scraping from Google Docs...`);
              const scrapedResult = await scrapeGoogleDoc(exercise.workPlatform!);
              
              if (scrapedResult.success && scrapedResult.content) {
                // Store in cache
                setCachedExercise(
                  exercise.workPlatform!,
                  exercise.id,
                  exercise.title,
                  scrapedResult.content,
                  conversation.id
                );
                
                return {
                  success: true,
                  content: scrapedResult.content,
                  url: exercise.workPlatform!,
                  title: exercise.title,
                  source: 'fresh',
                  age: 0,
                };
              }
              
              // FALLBACK: If scraping fails, try to get stale cached content (ignore expiry)
              const fallbackCached = getStaleCachedExercise(exercise.workPlatform!);
              if (fallbackCached) {
                console.log(`⚠️ [EXERCISE CACHE] Scraping failed for "${exercise.title}", using stale cache as fallback (age: ${fallbackCached.age}s)`);
                return {
                  success: true,
                  content: fallbackCached.content,
                  url: exercise.workPlatform!,
                  title: exercise.title,
                  source: 'stale-fallback',
                  age: fallbackCached.age,
                };
              }
              
              console.error(`❌ [EXERCISE CACHE] Failed to load "${exercise.title}": ${scrapedResult.error}`);
              return {
                success: false,
                content: null,
                url: exercise.workPlatform!,
                title: exercise.title,
                source: 'error',
                error: scrapedResult.error,
              };
            })
          );

          // Filter valid results
          const validExercises = loadedExercises.filter(result => {
            if (!result.success || !result.content) return false;

            const contentLower = result.content.toLowerCase();
            const hasErrorMessages =
              contentLower.includes("javascript isn't enabled") ||
              contentLower.includes("javascript is not enabled") ||
              contentLower.includes("browser is not supported") ||
              contentLower.includes("enable javascript") ||
              (contentLower.includes("error") && result.content.length < 200);

            return !hasErrorMessages;
          });

          // Build enhanced message with exercise content
          const scrapedData = validExercises
            .map((result) => {
              const fullContent = result.content!;
              const truncatedContent = contentLimit === Infinity ? fullContent : fullContent.substring(0, contentLimit);
              const charCount = truncatedContent.length;
              const sourceIcon = result.source === 'cache' ? '💾' : '🔄';
              const ageText = result.source === 'cache' ? ` (cache, ${result.age}s old)` : ' (fresh)';
              console.log(`   ${sourceIcon} "${result.title}": ${charCount.toLocaleString()} chars${ageText}`);
              return `\n\n[Contenuto dell'esercizio "${result.title}": ${result.url}]\n${truncatedContent}\n[Fine contenuto]`;
            })
            .join("\n");

          if (scrapedData) {
            enhancedMessage = `${message}\n${scrapedData}`;
            const totalChars = validExercises.reduce((sum, result) => sum + (result.content?.length || 0), 0);
            const cacheHits = validExercises.filter(r => r.source === 'cache').length;
            const freshScrapes = validExercises.filter(r => r.source === 'fresh').length;
            console.log(`✅ Added ${validExercises.length} exercise(s) to message (${totalChars.toLocaleString()} total chars)`);
            console.log(`   Cache: ${cacheHits} hits, ${freshScrapes} fresh scrapes`);
          } else if (exercisesToLoad.length > 0) {
            console.log(`⚠️ Attempted to load ${exercisesToLoad.length} exercise(s), but all returned errors or invalid content`);
          }
          
          // Log cache statistics periodically
          if (validExercises.length > 0) {
            logCacheStats();
          }
        }
      }
    }

    // Also extract and scrape any URLs directly in the message (limited to max 3 URLs)
    const urls = extractUrls(message).slice(0, 3);

    if (urls.length > 0) {
      console.log(`Found ${urls.length} URL(s) in message, scraping with cache-first logic...`);
      
      // Process each URL with cache-first logic for Google Docs
      const scrapedContents = await Promise.all(
        urls.map(async (url) => {
          // Check if URL is Google Doc - if so, try cache first
          if (url.includes('docs.google.com')) {
            // Try to match with an exercise from the list to use proper exerciseId
            const matchedExercise = userContext.exercises.all.find(e => e.workPlatform === url);
            
            if (matchedExercise) {
              // Use exercise cache flow
              const cached = getCachedExercise(url, matchedExercise.id, conversation.id);
              if (cached) {
                console.log(`✅ [URL CACHE HIT] Google Doc from message (${cached.age}s old)`);
                return { success: true, content: cached.content, url };
              }
              
              // Cache miss - scrape and store
              console.log(`🔄 [URL CACHE MISS] Scraping Google Doc from message...`);
              const scraped = await scrapeGoogleDoc(url);
              if (scraped.success && scraped.content) {
                setCachedExercise(url, matchedExercise.id, matchedExercise.title, scraped.content, conversation.id);
                return { success: true, content: scraped.content, url };
              }
              
              // Fallback to stale cache if scraping fails
              const stale = getStaleCachedExercise(url);
              if (stale) {
                console.log(`⚠️ [URL FALLBACK] Using stale cache for Google Doc (age: ${stale.age}s)`);
                return { success: true, content: stale.content, url };
              }
              
              return { success: false, content: null, url, error: scraped.error };
            }
          }
          
          // For non-Google-Doc URLs or unmatched docs, scrape directly
          const results = await scrapeMultipleUrls([url]);
          return results[0];
        })
      );

      const scrapedData = scrapedContents
        .filter(content => content.success && content.content)
        .map(content => {
          const urlType = isGoogleSheetsUrl(content.url) ? "Google Sheets" : 
                         content.url.includes('docs.google.com') ? "Google Doc" : "web page";
          const truncatedContent = content.content!.substring(0, 1500);
          return `\n\n[Contenuto da ${urlType}: ${content.url}]\n${truncatedContent}\n[Fine contenuto]`;
        })
        .join("\n");

      if (scrapedData) {
        enhancedMessage = `${message}\n${scrapedData}`;
        console.log(`Added ${scrapedContents.filter(c => c.success).length} scraped content(s) to message`);
      }
    }
    
    timings.exerciseScrapingEnd = performance.now();
    exerciseScrapingTime = Math.round(timings.exerciseScrapingEnd - timings.exerciseScrapingStart);
    console.log(`⏱️  [TIMING] Exercise scraping: ${exerciseScrapingTime}ms`);

    // Build system prompt (with hasFileSearch flag to omit KB content when using RAG)
    timings.promptBuildStart = performance.now();
    
    // Build set of indexed knowledge doc IDs for selective fallback
    // Include both client-owned and consultant-owned KB docs that are indexed
    const indexedKnowledgeDocIds = new Set<string>();
    if (hasFileSearch && userContext.knowledgeBase) {
      try {
        // Use simple query with only clientId to avoid complex or() conditions
        console.log(`🔍 [KB Fallback Debug] Querying indexed docs for clientId: ${clientId}, consultantId: ${consultantId}`);
        
        // Query for client-owned KB docs
        const clientKbDocs = await db.query.fileSearchDocuments.findMany({
          where: and(
            eq(fileSearchDocuments.sourceType, 'knowledge_base'),
            eq(fileSearchDocuments.clientId, clientId),
            eq(fileSearchDocuments.status, 'indexed')
          ),
          columns: { sourceId: true }
        });
        
        // Query for consultant-owned KB docs if consultantId is different
        let consultantKbDocs: { sourceId: string | null }[] = [];
        if (consultantId && consultantId !== clientId) {
          consultantKbDocs = await db.query.fileSearchDocuments.findMany({
            where: and(
              eq(fileSearchDocuments.sourceType, 'knowledge_base'),
              eq(fileSearchDocuments.consultantId, consultantId),
              eq(fileSearchDocuments.status, 'indexed')
            ),
            columns: { sourceId: true }
          });
        }
        
        // Combine results
        const indexedKbDocs = [...clientKbDocs, ...consultantKbDocs];
        
        for (const doc of indexedKbDocs) {
          if (doc.sourceId) {
            // Handle both regular docs and chunked docs (extract base ID from chunk_X suffix)
            const baseId = doc.sourceId.includes('_chunk_') 
              ? doc.sourceId.split('_chunk_')[0] 
              : doc.sourceId;
            indexedKnowledgeDocIds.add(baseId);
          }
        }
        console.log(`📚 [KB Fallback] ${indexedKnowledgeDocIds.size} KB docs indexed, ${userContext.knowledgeBase.documents.length - indexedKnowledgeDocIds.size} will be in prompt`);
      } catch (kbError) {
        console.error(`⚠️ [KB Fallback] Error querying indexed docs, skipping fallback:`, kbError);
        // Continue without fallback - all KB docs will go to File Search
      }
    }
    
    let systemPrompt = buildSystemPrompt(mode, consultantType || null, userContext, pageContext, { hasFileSearch: hasFileSearch, indexedKnowledgeDocIds });
    
    // Append agent context if available
    if (agentContext) {
      systemPrompt = systemPrompt + '\n\n' + agentContext;
    }
    
    // Append user preferences if available
    if (userPreferencesContext) {
      systemPrompt = systemPrompt + '\n\n' + userPreferencesContext;
    }

    // Calculate detailed token breakdown by section
    const breakdown = calculateTokenBreakdown(userContext, intent);
    timings.promptBuildEnd = performance.now();
    
    promptBuildTime = Math.round(timings.promptBuildEnd - timings.promptBuildStart);
    console.log(`⏱️  [TIMING] Prompt building: ${promptBuildTime}ms`);

    // Log token usage estimation for monitoring
    const systemPromptTokens = estimateTokens(systemPrompt);
    const userMessageTokens = estimateTokens(enhancedMessage);
    const historyTokens = conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const totalEstimatedTokens = systemPromptTokens + userMessageTokens + historyTokens;
    
    // Determine if File Search is active - MUST have actual documents
    const hasActiveFileSearchClient = hasFileSearch; // Uses the already-computed value that checks totalDocsInStores > 0

    console.log(`\n📊 Token Usage Estimation (Intent: ${intent}):`);
    console.log(`  - System Prompt: ~${systemPromptTokens.toLocaleString()} tokens`);
    console.log(`  - User Message: ~${userMessageTokens.toLocaleString()} tokens`);
    console.log(`  - Conversation History: ~${historyTokens.toLocaleString()} tokens`);
    console.log(`  - Total Estimated: ~${totalEstimatedTokens.toLocaleString()} tokens`);
    console.log(`  - File Search Mode: ${hasActiveFileSearchClient ? '✅ ACTIVE (RAG via stores)' : '❌ OFF (full content in prompt)'}`);

    // Log token breakdown with File Search awareness (pass actual indexed docs breakdown)
    logTokenBreakdown(breakdown, systemPromptTokens, hasActiveFileSearchClient, fileSearchBreakdown);

    // Prepare messages for Gemini
    const geminiMessages = [
      ...conversationHistory,
      { role: "user" as const, content: enhancedMessage },
    ];

    // Call Gemini API with streaming + RETRY LOGIC for 503 errors
    timings.geminiCallStart = performance.now();
    let accumulatedMessage = "";

    // Build FileSearch tool from stores already fetched above (only if stores have actual documents)
    const fileSearchTool = hasFileSearch ? fileSearchService.buildFileSearchTool(fileSearchStoreNames) : null;
    
    // 📊 LOG DISTINTIVO: FILE SEARCH vs RAG CLASSICO (CLIENT STREAMING)
    const ragTokensClient = breakdown.exercises + breakdown.library + breakdown.consultations + breakdown.knowledgeBase;
    
    console.log(`\n${'═'.repeat(70)}`);
    if (hasFileSearch) {
      console.log(`🔍 AI MODE: FILE SEARCH SEMANTIC (Gemini RAG) [CLIENT]`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores disponibili: ${fileSearchStoreNames.length}`);
      fileSearchStoreNames.forEach((name, i) => console.log(`      ${i + 1}. ${name}`));
      logFileSearchBreakdown(fileSearchBreakdown);
      console.log(`   ✅ Tool fileSearch: ATTIVO`);
      console.log(`   📄 Il modello cercherà semanticamente nei documenti indicizzati`);
      console.log(`   💰 RISPARMIO TOKENS: ~${ragTokensClient.toLocaleString()} tokens (esercizi+library+consultazioni+KB)`);
      console.log(`   📉 System prompt ridotto: da ~${(systemPromptTokens + ragTokensClient).toLocaleString()} a ~${systemPromptTokens.toLocaleString()} tokens`);
    } else {
      console.log(`📚 AI MODE: RAG CLASSICO (Context Injection) [CLIENT]`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores FileSearch: NESSUNO`);
      console.log(`   ❌ Tool fileSearch: NON ATTIVO`);
      console.log(`   📄 Tutto il contesto viene iniettato nel system prompt (~${systemPromptTokens.toLocaleString()} tokens)`);
      console.log(`   💡 TIP: Sincronizza i documenti per attivare File Search e ridurre i costi!`);
    }
    console.log(`${'═'.repeat(70)}\n`);

    // Select model dynamically based on provider (Gemini 3 only for Google AI Studio)
    const { model: clientStreamModel, useThinking: clientStreamUseThinking } = getTextChatModel(providerMetadata.name);
    console.log(`[AI] Using model: ${clientStreamModel} with thinking_level: ${clientStreamUseThinking ? GEMINI_3_THINKING_LEVEL : 'N/A (legacy)'} [CLIENT STREAMING]`);
    console.log(`[AI] Provider: ${providerMetadata.name} -> ${clientStreamUseThinking ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash'}`);

    // Create stream factory function with optional FileSearch tool
    const makeStreamAttempt = () => aiClient.generateContentStream({
      model: clientStreamModel,
      contents: geminiMessages.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        systemInstruction: systemPrompt,
        ...(clientStreamUseThinking && {
          thinkingConfig: {
            thinkingLevel: GEMINI_3_THINKING_LEVEL
          }
        }),
      },
      ...(fileSearchTool && { tools: [fileSearchTool] }),
    });

    // Stream with automatic retry and heartbeat using unified retry manager
    let clientUsageMetadata: GeminiUsageMetadata | undefined;
    for await (const chunk of streamWithRetriesAdapter(makeStreamAttempt, conversation.id, providerMetadata)) {
      yield chunk;
      
      // Accumulate delta content for DB storage
      if (chunk.type === 'delta' && chunk.content) {
        accumulatedMessage += chunk.content;
      }
      
      // Capture usageMetadata from complete event
      if (chunk.type === 'complete' && chunk.usageMetadata) {
        clientUsageMetadata = chunk.usageMetadata;
      }
    }

    timings.geminiCallEnd = performance.now();
    geminiCallTime = Math.round(timings.geminiCallEnd - timings.geminiCallStart);
    console.log(`⏱️  [TIMING] Gemini API call (with streaming): ${geminiCallTime}ms`);
    
    // Log REAL token usage from Gemini API (CLIENT)
    if (clientUsageMetadata) {
      console.log(`\n📊 TOKEN USAGE (REAL from Gemini) [CLIENT]:`);
      console.log(`   - Prompt tokens: ${(clientUsageMetadata.promptTokenCount || 0).toLocaleString()}`);
      console.log(`   - Response tokens: ${(clientUsageMetadata.candidatesTokenCount || 0).toLocaleString()}`);
      console.log(`   - Total tokens: ${(clientUsageMetadata.totalTokenCount || 0).toLocaleString()}`);
      if (clientUsageMetadata.cachedContentTokenCount) {
        console.log(`   - Cached tokens: ${clientUsageMetadata.cachedContentTokenCount.toLocaleString()}`);
      }
    } else {
      console.log(`\n⚠️  TOKEN USAGE: usageMetadata not available in streaming response [CLIENT]`);
    }

    let assistantMessage = accumulatedMessage || "Mi dispiace, non sono riuscito a generare una risposta.";

    // Extract suggested actions before saving
    const suggestedActions = extractSuggestedActions(assistantMessage, userContext);

    // Remove [ACTIONS] block from the message to keep it clean
    assistantMessage = assistantMessage.replace(/\[ACTIONS\]\s*\{[\s\S]*?\}\s*\[\/ACTIONS\]/g, '').trim();

    // Save assistant message with completed status
    const [savedMessage] = await db.insert(aiMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: assistantMessage,
        status: "completed",
        tokensUsed: null,
        metadata: suggestedActions.length > 0 ? { suggestedActions } : null,
      })
      .returning();

    // Track CLIENT knowledge base usage - increment usage count for all documents and APIs used in context
    if (userContext.knowledgeBase) {
      const documentIds = userContext.knowledgeBase.documents.map((d: any) => d.id);
      const apiIds = userContext.knowledgeBase.apiData
        .filter((a: any) => a.id)
        .map((a: any) => a.id as string);
      
      // Track usage asynchronously (don't block response)
      Promise.all([
        documentIds.length > 0 ? trackClientDocumentUsage(documentIds) : Promise.resolve(),
        apiIds.length > 0 ? trackClientApiUsage(apiIds) : Promise.resolve(),
      ]).catch(err => {
        console.error('❌ [Client Knowledge Tracking] Failed to track usage:', err);
      });
    }

    // Parallelize conversation and preferences updates
    await Promise.all([
      // Update conversation last message time
      db.update(aiConversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, conversation.id)),

      // Update user preferences last interaction
      db.insert(aiUserPreferences)
        .values({
          clientId,
          preferredMode: mode,
          preferredConsultantType: consultantType || 'finanziario',
          lastInteraction: new Date(),
        })
        .onConflictDoUpdate({
          target: aiUserPreferences.clientId,
          set: {
            preferredMode: mode,
            preferredConsultantType: consultantType || 'finanziario',
            lastInteraction: new Date(),
            updatedAt: new Date(),
          },
        })
    ]);

    console.log(`✅ AI streaming completed for message ${savedMessage.id}`);

    // 📊 LOG FILE SEARCH STREAMING SUMMARY (CLIENT)
    if (hasFileSearch) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🔍 FILE SEARCH STREAMING SUMMARY [CLIENT]`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`   📦 Stores attivi: ${fileSearchStoreNames.length}`);
      console.log(`   ⚠️  Nota: In modalità streaming, le citazioni non sono disponibili`);
      console.log(`      nel response object. File Search è stato configurato come tool.`);
      console.log(`   📄 Se la risposta cita documenti specifici, Gemini ha usato File Search.`);
      console.log(`${'─'.repeat(70)}\n`);
    } else {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📚 RAG CLASSICO STREAMING SUMMARY [CLIENT]`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`   ❌ File Search: NON ATTIVO`);
      console.log(`   📄 La risposta è basata interamente sul context injection`);
      console.log(`      (~${systemPromptTokens.toLocaleString()} tokens nel system prompt)`);
      console.log(`${'─'.repeat(70)}\n`);
    }

    // Calculate total timing
    timings.totalEnd = performance.now();
    const totalTime = Math.round(timings.totalEnd - timings.requestStart);
    
    // Log comprehensive timing breakdown
    console.log('\n' + '━'.repeat(70));
    console.log('⏱️  PERFORMANCE TIMING BREAKDOWN');
    console.log('━'.repeat(70));
    console.log(`   [0ms → ${contextBuildTime}ms] Context Building (${contextBuildTime}ms)`);
    console.log(`   [${contextBuildTime}ms → ${contextBuildTime + exerciseScrapingTime}ms] Exercise Scraping (${exerciseScrapingTime}ms)`);
    console.log(`   [${contextBuildTime + exerciseScrapingTime}ms → ${contextBuildTime + exerciseScrapingTime + promptBuildTime}ms] Prompt Building (${promptBuildTime}ms)`);
    console.log(`   [${contextBuildTime + exerciseScrapingTime + promptBuildTime}ms → ${totalTime}ms] Gemini API Call (${geminiCallTime}ms)`);
    console.log('   ' + '─'.repeat(68));
    console.log(`   ⏱️  TOTAL: ${(totalTime / 1000).toFixed(2)}s (${totalTime}ms)`);
    console.log('━'.repeat(70) + '\n');

    // Yield complete event
    yield {
      type: "complete",
      conversationId: conversation.id,
      messageId: savedMessage.id,
      suggestedActions,
    };

  } catch (error: any) {
    console.error("❌ Errore nel processing AI streaming:", error);

    // Determine error message based on error type
    let errorMessage = "Mi dispiace, si è verificato un errore. Riprova.";

    // Check for API_KEY_MISSING errors (from getAIProvider)
    if (error.message === "API_KEY_MISSING" || error.message?.includes("No Gemini API key available")) {
      errorMessage = "API Key Gemini mancante. Per favore, aggiungi la tua API Key personale nel profilo.";
    }
    // Check for 503/UNAVAILABLE errors (after all retries exhausted)
    else if (
      error.status === 503 ||
      error.status === 'UNAVAILABLE' ||
      error.status === 'SERVICE_UNAVAILABLE' ||
      (error.error && error.error.status === 'UNAVAILABLE') ||
      (error.error && error.error.code === 503) ||
      (error.message && error.message.includes('503')) ||
      (error.message && error.message.toLowerCase().includes('overloaded')) ||
      (error.message && error.message.toLowerCase().includes('unavailable'))
    ) {
      errorMessage = "Gemini non disponibile. Riprova tra qualche minuto.";
    }
    // Check for quota/rate limit errors (429)
    else if (error.status === 429 || (error.message && error.message.includes('quota')) ||
        (error.message && error.message.includes('rate limit'))) {
      errorMessage = "⏱️ Il servizio AI ha raggiunto il limite di utilizzo. Riprova tra 1 minuto.";
    }

    // Save error message if conversation exists
    if (conversation) {
      const [savedErrorMessage] = await db.insert(aiMessages)
        .values({
          conversationId: conversation.id,
          role: "assistant",
          content: errorMessage,
          status: "error",
        })
        .returning();

      // Parallelize error updates
      await Promise.all([
        // Update conversation timestamps even on error
        db.update(aiConversations)
          .set({
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(aiConversations.id, conversation.id)),

        // Update user preferences even on error
        db.insert(aiUserPreferences)
          .values({
            clientId,
            preferredMode: mode,
            preferredConsultantType: consultantType || 'finanziario',
            lastInteraction: new Date(),
          })
          .onConflictDoUpdate({
            target: aiUserPreferences.clientId,
            set: {
              preferredMode: mode,
              preferredConsultantType: consultantType || 'finanziario',
              lastInteraction: new Date(),
              updatedAt: new Date(),
            },
          })
      ]);

      // Yield error event
      yield {
        type: "error",
        conversationId: conversation.id,
        messageId: savedErrorMessage.id,
        error: errorMessage,
        content: errorMessage,
      };
    } else {
      // Yield error event without conversation
      yield {
        type: "error",
        conversationId: conversationId || "",
        error: errorMessage,
        content: errorMessage,
      };
    }
  } finally {
    // Cleanup AI provider resources
    if (aiProviderResult?.cleanup) {
      await aiProviderResult.cleanup();
    }
  }
}

export async function getConversations(clientId: string) {
  const conversations = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.clientId, clientId),
      eq(aiConversations.isActive, true)
    ))
    .orderBy(desc(aiConversations.lastMessageAt));

  return conversations;
}

export async function getConversationMessages(conversationId: string, clientId: string) {
  // Verify conversation belongs to client
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.clientId, clientId)
    ))
    .limit(1);

  if (!conversation) {
    throw new Error("Conversazione non trovata");
  }

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt);

  // Map messages to include suggestedActions from metadata
  const messagesWithActions = messages.map(msg => ({
    ...msg,
    suggestedActions: (msg.metadata as any)?.suggestedActions || undefined,
  }));

  return {
    conversation,
    messages: messagesWithActions,
  };
}

export async function deleteConversation(conversationId: string, clientId: string) {
  // Verify conversation belongs to client
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.clientId, clientId)
    ))
    .limit(1);

  if (!conversation) {
    throw new Error("Conversazione non trovata");
  }

  // Soft delete by marking as inactive
  await db
    .update(aiConversations)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  return { success: true };
}

export async function getUserPreferences(clientId: string) {
  const [preferences] = await db
    .select()
    .from(aiUserPreferences)
    .where(eq(aiUserPreferences.clientId, clientId))
    .limit(1);

  return preferences || {
    preferredMode: 'assistenza' as AIMode,
    preferredConsultantType: 'finanziario' as ConsultantType,
    enableProactiveSuggestions: true,
    dailyDigestEnabled: false,
  };
}

export async function buildDailyBriefing(clientId: string): Promise<string> {
  const userContext = await buildUserContext(clientId);

  const today = new Date();
  const greeting = getGreeting();

  let briefing = `${greeting} ${userContext.user.name}! 👋\n\n`;
  briefing += `Ecco il tuo riepilogo giornaliero:\n\n`;

  // Esercizi pendenti
  const pendingExercises = userContext.exercises.all.filter(
    e => e.status === 'pending' || e.status === 'in_progress'
  );

  if (pendingExercises.length > 0) {
    briefing += `📚 **Esercizi da Completare** (${pendingExercises.length}):\n`;

    // Esercizi con scadenza imminente (prossimi 3 giorni)
    const upcomingDeadlines = pendingExercises.filter(e => {
      if (!e.dueDate) return false;
      const dueDate = new Date(e.dueDate);
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= 3 && daysUntil >= 0;
    });

    if (upcomingDeadlines.length > 0) {
      briefing += `  ⚠️ Scadenza imminente:\n`;
      upcomingDeadlines.slice(0, 3).forEach(e => {
        const dueDate = new Date(e.dueDate!);
        const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        briefing += `    - ${e.title} (${e.category}) - Scade in ${daysUntil} giorni\n`;
      });
    } else {
      // Mostra i primi 3 esercizi pendenti
      pendingExercises.slice(0, 3).forEach(e => {
        const statusIcon = e.status === 'in_progress' ? '🔄' : '⏳';
        briefing += `  ${statusIcon} ${e.title} (${e.category})`;
        if (e.dueDate) {
          briefing += ` - Scadenza: ${new Date(e.dueDate).toLocaleDateString('it-IT')}`;
        }
        briefing += `\n`;
      });
    }
    briefing += `\n`;
  }

  // Esercizi ritornati per revisione
  const returnedExercises = userContext.exercises.all.filter(e => e.status === 'returned');
  if (returnedExercises.length > 0) {
    briefing += `🔙 **Esercizi da Revisionare** (${returnedExercises.length}):\n`;
    returnedExercises.slice(0, 2).forEach(e => {
      briefing += `  - ${e.title} - `;
      if (e.consultantFeedback && e.consultantFeedback.length > 0) {
        const latestFeedback = e.consultantFeedback[e.consultantFeedback.length - 1];
        briefing += `Feedback: "${latestFeedback.feedback.substring(0, 60)}..."`;
      } else {
        briefing += `Richiede modifiche`;
      }
      briefing += `\n`;
    });
    briefing += `\n`;
  }

  // Task di oggi
  const todayTasksIncomplete = userContext.dailyActivity.todayTasks.filter(t => !t.completed);
  if (todayTasksIncomplete.length > 0) {
    briefing += `✅ **Task di Oggi** (${todayTasksIncomplete.length} da completare):\n`;
    todayTasksIncomplete.slice(0, 3).forEach(t => {
      briefing += `  ⬜ ${t.description}\n`;
    });
    briefing += `\n`;
  }

  // Consulenze imminenti
  if (userContext.consultations.upcoming.length > 0) {
    briefing += `📅 **Prossime Consulenze**:\n`;
    userContext.consultations.upcoming.slice(0, 2).forEach(c => {
      const scheduledAt = new Date(c.scheduledAt);
      const isToday = scheduledAt.toDateString() === today.toDateString();
      const icon = isToday ? '🔔' : '📆';
      briefing += `  ${icon} ${scheduledAt.toLocaleString('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })} (${c.duration} minuti)\n`;
    });
    briefing += `\n`;
  }

  // Progressi università
  if (userContext.university.overallProgress.totalLessons > 0) {
    const { completedLessons, totalLessons, progressPercentage } = userContext.university.overallProgress;
    briefing += `🎓 **Progressi Università**: ${completedLessons}/${totalLessons} lezioni completate (${progressPercentage}%)\n\n`;
  }

  // Obiettivi attivi
  const activeGoals = userContext.goals.filter(g => g.status === 'active');
  if (activeGoals.length > 0) {
    briefing += `🎯 **Obiettivi Attivi** (${activeGoals.length}):\n`;
    activeGoals.slice(0, 2).forEach(g => {
      briefing += `  - ${g.title}: ${g.currentValue}/${g.targetValue}`;
      if (g.targetDate) {
        const targetDate = new Date(g.targetDate);
        const daysLeft = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0) {
          briefing += ` (${daysLeft} giorni rimanenti)`;
        }
      }
      briefing += `\n`;
    });
    briefing += `\n`;
  }

  // Motivazione finale
  if (pendingExercises.length === 0 && todayTasksIncomplete.length === 0) {
    briefing += `🎉 **Complimenti!** Sei in pari con tutto! Continua così!\n\n`;
  } else {
    briefing += `💪 **Iniziamo la giornata!** Come posso aiutarti oggi?\n\n`;
  }

  return briefing;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buongiorno';
  if (hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

// Helper function to extract suggested actions from AI response
function extractSuggestedActions(message: string, userContext: UserContext) {
  // Try to extract JSON actions from the response
  const actionsRegex = /\[ACTIONS\]\s*(\{[\s\S]*?\})\s*\[\/ACTIONS\]/;
  const match = message.match(actionsRegex);

  if (match && match[1]) {
    try {
      // Sanitize JSON before parsing - fix common malformations
      let jsonStr = match[1].trim();
      
      // Remove trailing commas before closing braces/brackets (common AI mistake)
      jsonStr = jsonStr.replace(/,(\s*[\]}])/g, '$1');
      
      // Remove any control characters that might break JSON parsing
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      const parsed = JSON.parse(jsonStr);
      if (parsed.actions && Array.isArray(parsed.actions)) {
        // Convert actions to expected format with defensive validation
        const validActions = parsed.actions
          .filter((action: any) => {
            // Validate required fields
            if (!action.type || !action.label) {
              console.warn('Skipping action with missing type or label:', action);
              return false;
            }
            return true;
          })
          .map((action: any) => {
            // Build data object based on action type
            const data: any = {};

            // Handle different action types
            if (action.route) {
              data.route = action.route;
            }

            if (action.exerciseId) {
              data.exerciseId = action.exerciseId;
            }

            if (action.documentId) {
              data.documentId = action.documentId;
            }

            if (action.lessonId) {
              data.lessonId = action.lessonId;
            }

            if (action.url) {
              data.url = action.url;
            }

            // Future-proof: allow other action data fields
            if (action.data) {
              Object.assign(data, action.data);
            }

            return {
              type: action.type,
              label: action.label,
              data,
            };
          });

        if (validActions.length > 0) {
          return validActions;
        }
      }
    } catch (error) {
      console.error('Error parsing actions JSON:', error);
      console.error('Problematic JSON string:', match[1]?.substring(0, 200));
      // Fall through to fallback logic - this is not critical, AI will still work
    }
  }

  // Fallback: keyword-based action suggestions if AI didn't provide structured actions
  const actions = [];
  const messageLower = message.toLowerCase();

  // Safely check exercises array
  if (userContext.exercises?.all && Array.isArray(userContext.exercises.all)) {
    // Check if AI mentions specific exercises by title
    for (const exercise of userContext.exercises.all.slice(0, 3)) {
      if (exercise?.title && messageLower.includes(exercise.title.toLowerCase())) {
        actions.push({
          type: 'open_exercise',
          label: `📝 Apri "${exercise.title}"`,
          data: { exerciseId: exercise.id, route: '/client/exercises' },
        });
      }
    }
  }

  // Check if AI mentions pending exercises
  if (userContext.exercises?.all && Array.isArray(userContext.exercises.all)) {
    const pendingExercises = userContext.exercises.all.filter(e => e.status === 'pending' || e.status === 'in_progress');
    if (messageLower.includes('esercizi') && pendingExercises.length > 0 && actions.length === 0) {
      actions.push({
        type: 'navigate',
        label: '📚 Visualizza esercizi pendenti',
        data: { route: '/client/exercises' },
      });
    }
  }

  // Check if AI mentions university courses or lessons
  if (messageLower.includes('università') || messageLower.includes('lezioni') || messageLower.includes('corsi')) {
    actions.push({
      type: 'navigate',
      label: '🎓 Vai all\'Università',
      data: { route: '/client/university' },
    });
  }

  // Check if AI mentions daily tasks
  if (userContext.dailyActivity?.todayTasks && Array.isArray(userContext.dailyActivity.todayTasks)) {
    if (messageLower.includes('task') && userContext.dailyActivity.todayTasks.length > 0) {
      actions.push({
        type: 'navigate',
        label: '✅ Visualizza task di oggi',
        data: { route: '/client/daily-tasks' },
      });
    }
  }

  // Check if AI mentions consultations
  if (messageLower.includes('consulenza') || messageLower.includes('appuntamento')) {
    if (userContext.consultations?.upcoming && Array.isArray(userContext.consultations.upcoming) && userContext.consultations.upcoming.length > 0) {
      actions.push({
        type: 'navigate',
        label: '📅 Visualizza prossime consulenze',
        data: { route: '/client/consultations' },
      });
    } else {
      actions.push({
        type: 'book_consultation',
        label: '📞 Prenota una consulenza',
        data: { route: '/client/consultations' },
      });
    }
  }

  // Check if AI mentions goals
  if (userContext.goals && Array.isArray(userContext.goals)) {
    if (messageLower.includes('obiettiv') && userContext.goals.length > 0) {
      actions.push({
        type: 'navigate',
        label: '🎯 Visualizza obiettivi',
        data: { route: '/client/goals' },
      });
    }
  }

  // Check if AI mentions specific library documents by title
  if (userContext.library?.documents && Array.isArray(userContext.library.documents)) {
    for (const doc of userContext.library.documents.slice(0, 3)) {
      if (doc?.title && messageLower.includes(doc.title.toLowerCase())) {
        actions.push({
          type: 'open_document',
          label: `📖 Apri "${doc.title}"`,
          data: { documentId: doc.id, route: '/client/library' },
        });
      }
    }
  }

  // Check if AI mentions specific lessons by title
  if (userContext.university?.assignedYears && Array.isArray(userContext.university.assignedYears)) {
    for (const year of userContext.university.assignedYears) {
      if (year?.trimesters && Array.isArray(year.trimesters)) {
        for (const trimester of year.trimesters) {
          if (trimester?.modules && Array.isArray(trimester.modules)) {
            for (const module of trimester.modules) {
              if (module?.lessons && Array.isArray(module.lessons)) {
                for (const lesson of module.lessons.slice(0, 2)) {
                  if (lesson?.title && messageLower.includes(lesson.title.toLowerCase())) {
                    actions.push({
                      type: 'open_lesson',
                      label: `🎓 Apri "${lesson.title}"`,
                      data: { lessonId: lesson.id, route: '/client/university' },
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Check if AI mentions library/documents (general)
  if ((messageLower.includes('libreria') || messageLower.includes('document')) && actions.length === 0) {
    actions.push({
      type: 'navigate',
      label: '📚 Vai alla Libreria',
      data: { route: '/client/library' },
    });
  }

  // Check if AI mentions roadmap
  if (messageLower.includes('roadmap') || messageLower.includes('percorso')) {
    actions.push({
      type: 'navigate',
      label: '🗺️ Visualizza Roadmap',
      data: { route: '/client/roadmap' },
    });
  }

  // Always return array (even if empty) to avoid undefined errors
  return actions;
}

// ========================================
// CONSULTANT AI ASSISTANT FUNCTIONS
// ========================================

export interface FocusedDocument {
  id: string;
  title: string;
  category?: string;
}

export interface ConsultantChatRequest {
  consultantId: string;
  message: string;
  conversationId?: string;
  pageContext?: import('./consultant-context-builder').ConsultantPageContext;
  focusedDocument?: FocusedDocument;
  // Agent context: Use selected WhatsApp agent as AI persona
  agentId?: string;
}

export async function* sendConsultantChatMessageStream(request: ConsultantChatRequest) {
  const { consultantId, message, conversationId, pageContext, focusedDocument, agentId } = request;

  // ========================================
  // AGENT CONTEXT: Fetch agent persona if agentId is provided
  // ========================================
  let agentContext = '';
  let agentConfig: typeof consultantWhatsappConfig.$inferSelect | null = null;
  
  if (agentId) {
    const [fetchedAgentConfig] = await db.select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentId))
      .limit(1);
    
    if (fetchedAgentConfig) {
      agentConfig = fetchedAgentConfig;
      console.log(`🤖 [Agent Context] Using agent "${agentConfig.agentName}" (${agentConfig.agentType}) for AI response`);
      
      agentContext = `
## Contesto Agente Attivo
Stai operando come l'agente "${agentConfig.agentName}".

### Personalità e Tono
- Tipo: ${agentConfig.agentType || 'general'}
- Personalità: ${agentConfig.aiPersonality || 'professional'}

### Informazioni Business
${agentConfig.businessName ? `- Nome Business: ${agentConfig.businessName}` : ''}
${agentConfig.businessDescription ? `- Descrizione: ${agentConfig.businessDescription}` : ''}
${agentConfig.whatWeDo ? `- Cosa Facciamo: ${agentConfig.whatWeDo}` : ''}
${agentConfig.whoWeHelp ? `- Chi Aiutiamo: ${agentConfig.whoWeHelp}` : ''}

### Istruzioni Specifiche
${agentConfig.agentInstructions || 'Nessuna istruzione specifica.'}

### REGOLA IMPORTANTE: Focus sull'Argomento
Sei specializzato negli argomenti relativi a questo agente ("${agentConfig.agentName}").
- Rispondi SOLO a domande pertinenti al tuo ruolo e competenze.
- Se l'utente chiede qualcosa fuori dal tuo ambito di competenza:
  1. Rispondi brevemente che questa domanda non rientra nelle tue competenze specifiche
  2. Suggerisci gentilmente di usare l'"Assistenza base" per domande generali o un altro agente appropriato
  3. Esempio: "Questa domanda riguarda [argomento X] che non rientra nelle mie competenze. Ti consiglio di provare con l'Assistenza base o con un agente specializzato in [argomento]."
- Non divagare su argomenti non pertinenti al tuo ruolo.
`;
    }
  }

  // ========================================
  // USER PREFERENCES CONTEXT: Fetch AI assistant preferences for consultant
  // ========================================
  let userPreferencesContext = '';
  try {
    const [prefs] = await db.select()
      .from(aiAssistantPreferences)
      .where(eq(aiAssistantPreferences.userId, consultantId))
      .limit(1);
    
    const writingStyleLabels: Record<string, string> = {
      default: 'Usa uno stile e tono predefiniti, naturali e bilanciati',
      professional: 'Sii cortese e preciso, mantieni un tono professionale',
      friendly: 'Sii espansivo e loquace, usa un tono amichevole e caloroso',
      direct: 'Sii diretto e incoraggiante, vai dritto al punto',
      eccentric: 'Sii vivace e fantasioso, usa un tono creativo e originale',
      efficient: 'Sii essenziale e semplice, rispondi in modo efficiente',
      nerd: 'Sii curioso e appassionato, approfondisci i dettagli tecnici',
      cynical: 'Sii critico e sarcastico, usa un tono ironico',
      custom: 'Segui le istruzioni personalizzate dell\'utente'
    };
    
    const responseLengthLabels: Record<string, string> = {
      short: 'Mantieni le risposte brevi (1-2 paragrafi)',
      balanced: 'Usa una lunghezza moderata',
      comprehensive: 'Fornisci risposte complete e dettagliate'
    };
    
    if (prefs) {
      // For consultants, include their own base instructions
      const baseInstructions = prefs.defaultSystemInstructions 
        ? `\n## Istruzioni Base del Sistema\n${prefs.defaultSystemInstructions}\n`
        : '';
      
      userPreferencesContext = `${baseInstructions}
## Preferenze di Comunicazione dell'Utente
- Stile di Scrittura: ${writingStyleLabels[prefs.writingStyle] || 'Professionale'}
- Lunghezza Risposte: ${responseLengthLabels[prefs.responseLength] || 'Bilanciata'}
${prefs.customInstructions ? `- Istruzioni Personalizzate: ${prefs.customInstructions}` : ''}

IMPORTANTE: Rispetta queste preferenze in tutte le tue risposte.
`;
      console.log(`📝 [User Preferences] Applying preferences - Style: ${prefs.writingStyle}, Length: ${prefs.responseLength}${prefs.defaultSystemInstructions ? ', with base instructions' : ''}`);
    }
  } catch (prefError) {
    console.log(`⚠️ [User Preferences] Could not fetch preferences:`, prefError);
  }

  const timings = {
    requestStart: performance.now(),
    contextBuildStart: 0,
    contextBuildEnd: 0,
    promptBuildStart: 0,
    promptBuildEnd: 0,
    geminiCallStart: 0,
    geminiCallEnd: 0,
    totalEnd: 0,
  };

  let contextBuildTime = 0;
  let promptBuildTime = 0;
  let geminiCallTime = 0;

  // Declare aiProviderResult outside try block so finally can access it
  let aiProviderResult: AiProviderResult | undefined;

  let conversation;
  let conversationHistory: ChatMessage[] = [];

  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧑‍💼 CONSULTANT AI ASSISTANT - New Chat Message`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Consultant ID: ${consultantId}`);
    console.log(`Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    console.log(`${'='.repeat(70)}\n`);

    // Verify user exists and is a consultant
    const [consultant] = await db
      .select()
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (!consultant || consultant.role !== 'consultant') {
      throw new Error("Utente non autorizzato");
    }

    // 🔍 FILE SEARCH: Check if consultant has FileSearchStore with ACTUAL DOCUMENTS
    // File Search ONLY works with Google AI Studio (@google/genai), NOT Vertex AI
    const { storeNames: consultantFileSearchStoreNames, breakdown: consultantFileSearchBreakdown } = await fileSearchService.getStoreBreakdownForGeneration(
      consultantId,
      'consultant'
    );
    // FIX: Only consider File Search active if stores have actual documents
    const totalConsultantDocsInStores = consultantFileSearchBreakdown.reduce((sum, store) => sum + store.totalDocs, 0);
    const hasConsultantFileSearch = consultantFileSearchStoreNames.length > 0 && totalConsultantDocsInStores > 0;
    
    if (consultantFileSearchStoreNames.length > 0 && totalConsultantDocsInStores === 0) {
      console.log(`⚠️ [FileSearch] Consultant stores exist but are EMPTY (0 documents) - disabling File Search mode`);
    }

    // Get AI provider - Use Google AI Studio if File Search is active, otherwise 3-tier system
    let aiClient: any;
    let providerMetadata: AiProviderMetadata;
    
    if (hasConsultantFileSearch) {
      // 🔍 FILE SEARCH MODE: Force Google AI Studio (Vertex AI doesn't support File Search)
      const fileSearchProvider = await getGoogleAIStudioClientForFileSearch(consultantId);
      if (fileSearchProvider) {
        aiClient = fileSearchProvider.client;
        providerMetadata = fileSearchProvider.metadata;
        aiProviderResult = { client: aiClient, metadata: providerMetadata, source: 'google' };
      } else {
        // Fallback to normal provider if Google AI Studio not available
        console.log(`⚠️ File Search stores found but Google AI Studio not available, falling back to normal provider`);
        aiProviderResult = await getAIProvider(consultantId, consultantId);
        aiClient = aiProviderResult.client;
        providerMetadata = aiProviderResult.metadata;
      }
    } else {
      // Normal 3-tier priority system (Vertex AI client -> Vertex AI admin -> Google AI Studio)
      aiProviderResult = await getAIProvider(consultantId, consultantId);
      aiClient = aiProviderResult.client;
      providerMetadata = aiProviderResult.metadata;
    }

    // Build consultant context with smart filtering (intent detection happens inside buildConsultantContext)
    timings.contextBuildStart = performance.now();
    const consultantContext: ConsultantContext = await buildConsultantContext(consultantId, { 
      message, 
      pageContext,
      focusedDocument
    });
    timings.contextBuildEnd = performance.now();
    contextBuildTime = Math.round(timings.contextBuildEnd - timings.contextBuildStart);
    console.log(`⏱️  [TIMING] Consultant context building: ${contextBuildTime}ms`);

    // Get or create conversation
    if (conversationId) {
      const [existing] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.clientId, consultantId)
        ))
        .limit(1);

      if (!existing) {
        throw new Error("Conversazione non trovata");
      }

      conversation = existing;

      // Get conversation history
      const history = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversationId, conversationId))
        .orderBy(aiMessages.createdAt);

      conversationHistory = history.map((msg: any) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));
    } else {
      // Create new conversation for consultant
      const [newConversation] = await db
        .insert(aiConversations)
        .values({
          clientId: consultantId,
          agentId: agentId || null, // Save agent ID if provided, null for base assistance
          mode: 'assistenza',
          consultantType: null,
          title: message.substring(0, 50),
          isActive: true,
        })
        .returning();

      conversation = newConversation;
    }

    // Save user message with status='completed'
    await db.insert(aiMessages).values({
      conversationId: conversation.id,
      role: "user",
      content: message,
      status: "completed",
      contextSnapshot: consultantContext as any,
    });

    // Build consultant-specific system prompt
    timings.promptBuildStart = performance.now();
    let systemPrompt = buildConsultantSystemPrompt(consultantContext);
    
    // Append agent context if available
    if (agentContext) {
      systemPrompt = systemPrompt + '\n\n' + agentContext;
    }
    
    // Append user preferences if available
    if (userPreferencesContext) {
      systemPrompt = systemPrompt + '\n\n' + userPreferencesContext;
    }
    timings.promptBuildEnd = performance.now();
    promptBuildTime = Math.round(timings.promptBuildEnd - timings.promptBuildStart);
    console.log(`⏱️  [TIMING] Consultant prompt building: ${promptBuildTime}ms`);

    // Log token usage estimation for monitoring
    const systemPromptTokens = estimateTokens(systemPrompt);
    const userMessageTokens = estimateTokens(message);
    const historyTokens = conversationHistory.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const totalEstimatedTokens = systemPromptTokens + userMessageTokens + historyTokens;

    console.log(`\n📊 Token Usage Estimation:`);
    console.log(`  - System Prompt: ~${systemPromptTokens.toLocaleString()} tokens`);
    console.log(`  - User Message: ~${userMessageTokens.toLocaleString()} tokens`);
    console.log(`  - Conversation History: ~${historyTokens.toLocaleString()} tokens`);
    console.log(`  - Total Estimated: ~${totalEstimatedTokens.toLocaleString()} tokens\n`);

    // Prepare messages for Gemini
    const geminiMessages = [
      ...conversationHistory,
      { role: "user" as const, content: message },
    ];

    // Call Gemini API with streaming + RETRY LOGIC for 503 errors
    timings.geminiCallStart = performance.now();
    let accumulatedMessage = "";

    // Build FileSearch tool from stores already fetched above (only if stores have actual documents)
    const consultantFileSearchTool = hasConsultantFileSearch ? fileSearchService.buildFileSearchTool(consultantFileSearchStoreNames) : null;
    
    // 📊 LOG DISTINTIVO: FILE SEARCH vs RAG CLASSICO (CONSULTANT)
    console.log(`\n${'═'.repeat(70)}`);
    if (hasConsultantFileSearch) {
      console.log(`🔍 AI MODE: FILE SEARCH SEMANTIC (Gemini RAG) [CONSULTANT]`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores disponibili: ${consultantFileSearchStoreNames.length}`);
      consultantFileSearchStoreNames.forEach((name, i) => console.log(`      ${i + 1}. ${name}`));
      logFileSearchBreakdown(consultantFileSearchBreakdown);
      console.log(`   ✅ Tool fileSearch: ATTIVO`);
      console.log(`   📄 Il modello cercherà semanticamente nei documenti indicizzati`);
      console.log(`   📉 System prompt ridotto grazie a File Search`);
    } else {
      console.log(`📚 AI MODE: RAG CLASSICO (Context Injection) [CONSULTANT]`);
      console.log(`${'═'.repeat(70)}`);
      console.log(`   📦 Stores FileSearch: NESSUNO`);
      console.log(`   ❌ Tool fileSearch: NON ATTIVO`);
      console.log(`   📄 Tutto il contesto viene iniettato nel system prompt (~${systemPromptTokens.toLocaleString()} tokens)`);
      console.log(`   💡 TIP: Vai su AI Settings > File Search per sincronizzare i documenti!`);
    }
    console.log(`${'═'.repeat(70)}\n`);

    // Select model dynamically based on provider (Gemini 3 only for Google AI Studio)
    const { model: selectedModel, useThinking } = getTextChatModel(providerMetadata.name);
    console.log(`[AI] Using model: ${selectedModel} with thinking_level: ${useThinking ? GEMINI_3_THINKING_LEVEL : 'N/A (legacy)'} [CONSULTANT STREAMING]`);
    console.log(`[AI] Provider: ${providerMetadata.name} -> ${useThinking ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash'}`);

    // Create stream factory function with optional FileSearch tool
    const makeStreamAttempt = () => aiClient.generateContentStream({
      model: selectedModel,
      contents: geminiMessages.map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        systemInstruction: systemPrompt,
        ...(useThinking && {
          thinkingConfig: {
            thinkingLevel: GEMINI_3_THINKING_LEVEL
          }
        }),
      },
      ...(consultantFileSearchTool && { tools: [consultantFileSearchTool] }),
    });

    // Stream with automatic retry and heartbeat using unified retry manager
    let consultantUsageMetadata: GeminiUsageMetadata | undefined;
    for await (const chunk of streamWithRetriesAdapter(makeStreamAttempt, conversation.id, providerMetadata)) {
      yield chunk;
      
      // Accumulate delta content for DB storage
      if (chunk.type === 'delta' && chunk.content) {
        accumulatedMessage += chunk.content;
      }
      
      // Capture usageMetadata from complete event
      if (chunk.type === 'complete' && chunk.usageMetadata) {
        consultantUsageMetadata = chunk.usageMetadata;
      }
    }

    timings.geminiCallEnd = performance.now();
    geminiCallTime = Math.round(timings.geminiCallEnd - timings.geminiCallStart);
    console.log(`⏱️  [TIMING] Gemini API call (with streaming): ${geminiCallTime}ms`);
    
    // Log REAL token usage from Gemini API (CONSULTANT)
    if (consultantUsageMetadata) {
      console.log(`\n📊 TOKEN USAGE (REAL from Gemini) [CONSULTANT]:`);
      console.log(`   - Prompt tokens: ${(consultantUsageMetadata.promptTokenCount || 0).toLocaleString()}`);
      console.log(`   - Response tokens: ${(consultantUsageMetadata.candidatesTokenCount || 0).toLocaleString()}`);
      console.log(`   - Total tokens: ${(consultantUsageMetadata.totalTokenCount || 0).toLocaleString()}`);
      if (consultantUsageMetadata.cachedContentTokenCount) {
        console.log(`   - Cached tokens: ${consultantUsageMetadata.cachedContentTokenCount.toLocaleString()}`);
      }
    } else {
      console.log(`\n⚠️  TOKEN USAGE: usageMetadata not available in streaming response [CONSULTANT]`);
    }

    let assistantMessage = accumulatedMessage || "Mi dispiace, non sono riuscito a generare una risposta.";

    // Save assistant message with completed status
    const [savedMessage] = await db.insert(aiMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: assistantMessage,
        status: "completed",
        tokensUsed: null,
      })
      .returning();

    // Update conversation last message time
    await db.update(aiConversations)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiConversations.id, conversation.id));

    console.log(`✅ Consultant AI streaming completed for message ${savedMessage.id}`);

    // 📊 LOG FILE SEARCH STREAMING SUMMARY (CONSULTANT)
    if (hasConsultantFileSearch) {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`🔍 FILE SEARCH STREAMING SUMMARY [CONSULTANT]`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`   📦 Stores attivi: ${consultantFileSearchStoreNames.length}`);
      console.log(`   ⚠️  Nota: In modalità streaming, le citazioni non sono disponibili`);
      console.log(`      nel response object. File Search è stato configurato come tool.`);
      console.log(`   📄 Se la risposta cita documenti specifici, Gemini ha usato File Search.`);
      console.log(`${'─'.repeat(70)}\n`);
    } else {
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📚 RAG CLASSICO STREAMING SUMMARY [CONSULTANT]`);
      console.log(`${'─'.repeat(70)}`);
      console.log(`   ❌ File Search: NON ATTIVO`);
      console.log(`   📄 La risposta è basata interamente sul context injection`);
      console.log(`      (~${systemPromptTokens.toLocaleString()} tokens nel system prompt)`);
      console.log(`${'─'.repeat(70)}\n`);
    }

    // Track knowledge base usage - increment usage count for all documents and APIs used in context
    if (consultantContext.knowledgeBase) {
      const documentIds = consultantContext.knowledgeBase.documents.map(d => d.id);
      const apiIds = consultantContext.knowledgeBase.apiData
        .filter(a => a.id)
        .map(a => a.id as string);
      
      // Track usage asynchronously (don't block response)
      Promise.all([
        documentIds.length > 0 ? trackDocumentUsage(documentIds) : Promise.resolve(),
        apiIds.length > 0 ? trackApiUsage(apiIds) : Promise.resolve(),
      ]).catch(err => {
        console.error('❌ [Knowledge Tracking] Failed to track usage:', err);
      });
    }

    // Calculate total timing
    timings.totalEnd = performance.now();
    const totalTime = Math.round(timings.totalEnd - timings.requestStart);

    // Log comprehensive timing breakdown
    console.log('\n' + '━'.repeat(70));
    console.log('⏱️  PERFORMANCE TIMING BREAKDOWN');
    console.log('━'.repeat(70));
    console.log(`   [0ms → ${contextBuildTime}ms] Context Building (${contextBuildTime}ms)`);
    console.log(`   [${contextBuildTime}ms → ${contextBuildTime + promptBuildTime}ms] Prompt Building (${promptBuildTime}ms)`);
    console.log(`   [${contextBuildTime + promptBuildTime}ms → ${totalTime}ms] Gemini API Call (${geminiCallTime}ms)`);
    console.log('   ' + '─'.repeat(68));
    console.log(`   ⏱️  TOTAL: ${(totalTime / 1000).toFixed(2)}s (${totalTime}ms)`);
    console.log('━'.repeat(70) + '\n');

    // Yield complete event
    yield {
      type: "complete",
      conversationId: conversation.id,
      messageId: savedMessage.id,
    };

  } catch (error: any) {
    console.error("❌ Errore nel processing Consultant AI streaming:", error);

    // Determine error message based on error type
    let errorMessage = "Mi dispiace, si è verificato un errore. Riprova.";

    // Check for API_KEY_MISSING errors (from getAIProvider)
    if (error.message === "API_KEY_MISSING" || error.message?.includes("No Gemini API key available")) {
      errorMessage = "API Key Gemini mancante. Per favore, aggiungi la tua API Key personale nel profilo.";
    }
    // Check for 503/UNAVAILABLE errors (after all retries exhausted)
    else if (
      error.status === 503 ||
      error.status === 'UNAVAILABLE' ||
      error.status === 'SERVICE_UNAVAILABLE' ||
      (error.error && error.error.status === 'UNAVAILABLE') ||
      (error.error && error.error.code === 503) ||
      (error.message && error.message.includes('503')) ||
      (error.message && error.message.toLowerCase().includes('overloaded')) ||
      (error.message && error.message.toLowerCase().includes('unavailable'))
    ) {
      errorMessage = "Gemini non disponibile. Riprova tra qualche minuto.";
    }
    // Check for quota/rate limit errors (429)
    else if (error.status === 429 || (error.message && error.message.includes('quota')) ||
      (error.message && error.message.includes('rate limit'))) {
      errorMessage = "⏱️ Il servizio AI ha raggiunto il limite di utilizzo. Riprova tra 1 minuto.";
    }

    // Save error message if conversation exists
    if (conversation) {
      const [savedErrorMessage] = await db.insert(aiMessages)
        .values({
          conversationId: conversation.id,
          role: "assistant",
          content: errorMessage,
          status: "error",
        })
        .returning();

      // Update conversation timestamps even on error
      await db.update(aiConversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, conversation.id));

      // Yield error event
      yield {
        type: "error",
        conversationId: conversation.id,
        messageId: savedErrorMessage.id,
        error: errorMessage,
        content: errorMessage,
      };
    } else {
      // Yield error event without conversation
      yield {
        type: "error",
        conversationId: conversationId || "",
        error: errorMessage,
        content: errorMessage,
      };
    }
  } finally {
    // Cleanup AI provider resources
    if (aiProviderResult?.cleanup) {
      await aiProviderResult.cleanup();
    }
  }
}

export function buildConsultantSystemPrompt(context: ConsultantContext): string {
  const baseContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ DATA E ORA CORRENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Data di oggi: ${new Date(context.currentDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
🕐 Ora corrente: ${new Date(context.currentDateTime).toLocaleTimeString('it-IT')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.pageContext && context.pageContext.contextNotes.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CONTESTO PAGINA CORRENTE - PRIORITÀ MASSIMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Pagina attuale: ${context.pageContext.pageType}

${context.pageContext.contextNotes.map(note => `📌 ${note}`).join('\n')}

⚠️ ISTRUZIONI IMPORTANTI:
- Quando l'utente chiede "in che sezione sono" o "dove mi trovo",
  rispondi SEMPRE basandoti su queste informazioni contestuali.
- Dai PRIORITÀ a questo contesto rispetto ai dati generali della dashboard.
- Se l'utente fa una domanda vaga, interpreta la domanda nel contesto
  della pagina corrente prima di dare una risposta generica.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}
Informazioni sul Consulente:
- Nome: ${context.consultant.name}
- Email: ${context.consultant.email}
- Ruolo: ${context.consultant.role}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DASHBOARD CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metriche Chiave:
- 👥 Clienti totali: ${context.dashboard.totalClients}
- ✅ Clienti attivi: ${context.dashboard.activeClients} (attività negli ultimi 30 giorni o nuovi iscritti)
- ⚠️ Clienti inattivi: ${context.dashboard.totalClients - context.dashboard.activeClients} (oltre 30 giorni senza attività)
- 📝 Esercizi da revisionare: ${context.dashboard.pendingReviews}
- 📅 Appuntamenti in programma: ${context.dashboard.upcomingAppointments}
- 🔔 Appuntamenti oggi: ${context.dashboard.todayAppointments}

${context.clients.all.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 PANORAMICA CLIENTI (${context.clients.all.length} totali)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.clients.all.map(client => `
📌 ${client.name} (${client.email})
   - Livello: ${client.level}
   - Iscritto il: ${client.enrolledAt ? new Date(client.enrolledAt).toLocaleDateString('it-IT') : 'N/A'}
   - Ultima attività: ${client.lastActivity ? new Date(client.lastActivity).toLocaleDateString('it-IT') : 'N/A'}
   
   📊 Statistiche:
   - Esercizi assegnati: ${client.stats.assignedExercises}
   - Esercizi completati: ${client.stats.completedExercises}
   - Esercizi pending: ${client.stats.pendingExercises}
   - Tasso completamento: ${client.stats.completionRate}%
   - Progressi università: ${client.stats.universityProgress}%
`).join('\n')}
` : 'Nessun cliente assegnato.'}

${context.university.templates.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 UNIVERSITÀ - Percorsi/Template Disponibili
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.university.templates.map(t => `
📋 ${t.name} ${t.isActive ? '✅ ATTIVO' : '❌ INATTIVO'}
   ${t.description || 'Nessuna descrizione'}
   Creato: ${new Date(t.createdAt).toLocaleDateString('it-IT')}
`).join('\n')}

📊 STATS PERCORSI: ${context.university.stats.totalTemplates} totali, ${context.university.stats.activeTemplates} attivi
` : ''}

${context.university.yearAssignments.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 UNIVERSITÀ - Progresso Dettagliato Studenti
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.university.yearAssignments.map(a => `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📚 ${a.clientName} - ${a.yearName}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 PROGRESSO COMPLESSIVO: ${a.progress}% (${a.completedLessons}/${a.totalLessons} lezioni completate)
📅 Assegnato: ${new Date(a.assignedAt).toLocaleDateString('it-IT')}

${a.trimesters && a.trimesters.length > 0 ? `
🗂️ STRUTTURA DETTAGLIATA:

${a.trimesters.map(trim => `
   ▶️ ${trim.title}
${trim.modules.map(mod => `
      📦 ${mod.title}
${mod.lessons.map(lesson => `
         ${lesson.isCompleted ? '✅' : '⬜'} ${lesson.title}
`).join('')}`).join('\n')}`).join('\n')}
` : '⚠️ Struttura non disponibile per questo anno'}
`).join('\n')}

📊 STATS PROGRESSI: ${context.university.stats.totalAssignments} assegnamenti, ${context.university.stats.avgProgress}% progresso medio, ${context.university.stats.activeStudents} studenti attivi
` : ''}

${context.clientStates.all.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 STATO CLIENTI - Analisi Profonda (${context.clientStates.stats.totalWithState} configurati)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANTE: Questa sezione contiene informazioni CRITICHE sullo stato attuale e ideale dei clienti.
Usa questi dati per fornire risposte precise su:
- Dove si trova il cliente ADESSO (Stato Attuale)
- Dove VUOLE arrivare (Stato Ideale)
- Cosa lo motiva e quali ostacoli affronta
- La sua visione a lungo termine (3-5 anni)

${context.clientStates.all.map(state => {
  const client = context.clients.all.find(c => c.id === state.clientId);
  return `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 👤 ${state.clientName}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 STATO ATTUALE:
${state.currentState}

🎯 STATO IDEALE (obiettivo):
${state.idealState}

${state.internalBenefit ? `💎 BENEFICIO INTERNO (motivazione personale):
${state.internalBenefit}
` : ''}
${state.externalBenefit ? `🌟 BENEFICIO ESTERNO (riconoscimento):
${state.externalBenefit}
` : ''}
${state.mainObstacle ? `⚠️ OSTACOLO PRINCIPALE:
${state.mainObstacle}
` : ''}
${state.pastAttempts ? `📋 COSA HA GIÀ PROVATO IN PASSATO:
${state.pastAttempts}
` : ''}
${state.currentActions ? `🔄 COSA STA FACENDO ADESSO:
${state.currentActions}
` : ''}
${state.futureVision ? `🔮 DOVE VUOLE ESSERE TRA 3-5 ANNI:
${state.futureVision}
` : ''}
${state.motivationDrivers ? `🚀 COSA LO MOTIVA A RAGGIUNGERE I RISULTATI:
${state.motivationDrivers}
` : ''}
🕐 Ultimo aggiornamento: ${new Date(state.lastUpdated).toLocaleDateString('it-IT')}
${client ? `📊 Progresso università: ${client.stats.universityProgress}% | Completamento esercizi: ${client.stats.completionRate}%` : ''}
`;
}).join('\n')}

📊 STATISTICHE STATO CLIENTI:
- Clienti con stato configurato: ${context.clientStates.stats.totalWithState}
- Clienti senza stato: ${context.clientStates.stats.totalWithoutState}
${context.clientStates.stats.totalWithoutState > 0 ? `
⚠️ NOTA: ${context.clientStates.stats.totalWithoutState} clienti non hanno ancora uno stato configurato.
Suggerisci al consulente di configurarlo per avere una visione completa.` : ''}
` : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 STATO CLIENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Nessun cliente ha ancora uno stato configurato.
Per fornire un supporto migliore, suggerisci al consulente di configurare lo stato dei clienti
nella sezione "Gestione Stato Clienti".
`}

${context.exercises.pendingReviews.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 ESERCIZI DA REVISIONARE (${context.exercises.pendingReviews.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.exercises.pendingReviews.slice(0, 10).map(ex => `
  ⏳ ${ex.exerciseTitle}
     Cliente: ${ex.clientName}
     Consegnato: ${new Date(ex.submittedAt).toLocaleDateString('it-IT')}
     ${ex.dueDate ? `Scadenza: ${new Date(ex.dueDate).toLocaleDateString('it-IT')}` : 'Nessuna scadenza'}
`).join('\n')}

${context.exercises.pendingReviews.length > 10 ? `... e altri ${context.exercises.pendingReviews.length - 10} esercizi da revisionare` : ''}
` : ''}

${context.exerciseFeedback.recent.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FEEDBACK ESERCIZI (ultimi ${context.exerciseFeedback.stats.total})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.exerciseFeedback.recent.map(f => `
✍️ ${f.exerciseTitle} - ${f.clientName}
   ${f.feedbackItems.length > 0 ? f.feedbackItems.map((item: any) => `Feedback: ${item.feedback}\n   Data: ${new Date(item.timestamp).toLocaleDateString('it-IT')}`).join('\n   ') : 'Nessun feedback'}
   Ultimo feedback: ${f.lastFeedbackAt ? new Date(f.lastFeedbackAt).toLocaleDateString('it-IT') : 'N/A'}
`).join('\n')}

📊 STATS: ${context.exerciseFeedback.stats.total} feedback totali, ${context.exerciseFeedback.stats.withFeedback} con commenti
` : ''}

${context.exerciseTemplates.available.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 ESERCIZI MODELLO (${context.exerciseTemplates.stats.total} disponibili)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.exerciseTemplates.available.slice(0, 10).map(t => `
📝 ${t.name} [${t.category}]
   Tipo: ${t.type} | Durata: ${t.estimatedDuration || 'N/A'} min
   Utilizzi: ${t.usageCount || 0}
`).join('\n')}

📊 STATS: ${context.exerciseTemplates.stats.total} templates, ${context.exerciseTemplates.stats.totalUsage} utilizzi totali
` : ''}

${context.exercises.recentlyCreated.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 ESERCIZI CREATI DI RECENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.exercises.recentlyCreated.map(ex => `
  - ${ex.title} (${ex.category})
    Assegnato a: ${ex.assignedTo} clienti
    Creato: ${new Date(ex.createdAt).toLocaleDateString('it-IT')}
`).join('\n')}
` : ''}

Statistiche Esercizi:
- Totale creati: ${context.exercises.stats.totalCreated}
- Totale assegnati: ${context.exercises.stats.totalAssigned}
- In attesa di revisione: ${context.exercises.stats.awaitingReview}
- Completati questa settimana: ${context.exercises.stats.completedThisWeek}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL MARKETING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Automazione:
- Stato: ${context.emailMarketing.automation.enabled ? '✅ Abilitata' : '❌ Disabilitata'}
- Scheduler: ${context.emailMarketing.automation.schedulerActive ? '🟢 Attivo' : '⚪ Inattivo'}
- Ultima esecuzione: ${context.emailMarketing.automation.lastRun ? new Date(context.emailMarketing.automation.lastRun).toLocaleString('it-IT') : 'Mai'}
- Prossima esecuzione: ${context.emailMarketing.automation.nextRun || 'Non programmata'}

${context.emailMarketing.recentDrafts.length > 0 ? `
Bozze Recenti (${context.emailMarketing.recentDrafts.length}):
${context.emailMarketing.recentDrafts.slice(0, 5).map(draft => `
  - ${draft.clientName}: "${draft.subject}"
    Stato: ${draft.status}
    Generata: ${new Date(draft.generatedAt).toLocaleDateString('it-IT')}
`).join('\n')}
` : 'Nessuna bozza recente'}

Statistiche Email:
- Totale inviate: ${context.emailMarketing.stats.totalSent}
- Inviate questa settimana: ${context.emailMarketing.stats.sentThisWeek}
- Inviate questo mese: ${context.emailMarketing.stats.sentThisMonth}
- Bozze in attesa: ${context.emailMarketing.stats.pendingDrafts}

${context.emailMarketingDetailed ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 EMAIL MARKETING - DETTAGLI COMPLETI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.emailMarketingDetailed.smtpConfig ? `
🔧 Configurazione SMTP:
- Host: ${context.emailMarketingDetailed.smtpConfig.host}
- Porta: ${context.emailMarketingDetailed.smtpConfig.port}
- Secure: ${context.emailMarketingDetailed.smtpConfig.secure ? 'Sì' : 'No'}
- Username: ${context.emailMarketingDetailed.smtpConfig.username}
- From Email: ${context.emailMarketingDetailed.smtpConfig.fromEmail}
- From Name: ${context.emailMarketingDetailed.smtpConfig.fromName}
- Tone: ${context.emailMarketingDetailed.smtpConfig.emailTone || 'N/A'}
- Frequenza invii: ogni ${context.emailMarketingDetailed.smtpConfig.emailFrequencyDays} giorni
- Stato: ${context.emailMarketingDetailed.smtpConfig.isActive ? '✅ Attivo' : '❌ Inattivo'}
` : 'Configurazione SMTP non disponibile'}

${context.emailMarketingDetailed.schedulerLogs.length > 0 ? `
📋 Esecuzioni Scheduler (ultimi 10 run):
${context.emailMarketingDetailed.schedulerLogs.map(log => `
  📅 ${new Date(log.executedAt).toLocaleString('it-IT')}
     Clienti processati: ${log.clientsProcessed} | Email inviate: ${log.emailsSent} | Bozze create: ${log.draftsCreated}
     Errori: ${log.errors} | Stato: ${log.status === 'success' ? '✅' : log.status === 'partial' ? '⚠️' : '❌'} ${log.status}
     ${log.errorDetails ? '⚠️ Dettagli errore: ' + log.errorDetails : ''}
`).join('')}
` : ''}

${context.emailMarketingDetailed.emailHistory.length > 0 ? `
📨 Storico Invii (ultimi 30 giorni - ${context.emailMarketingDetailed.emailHistory.length} email):
${context.emailMarketingDetailed.emailHistory.slice(0, 10).map(email => `
  - ${email.clientName}: "${email.subject}"
    Tipo: ${email.emailType} | Journey Day: ${email.journeyDay || 'N/A'}
    Inviata: ${new Date(email.sentAt).toLocaleDateString('it-IT')}
    Aperta: ${email.openedAt ? '✅ ' + new Date(email.openedAt).toLocaleDateString('it-IT') : '❌ Non aperta'}
    ${email.isTest ? '🧪 Test' : ''}
`).join('\n')}

📊 OPEN RATE ultimi 30 giorni:
   Email inviate: ${context.emailMarketingDetailed.emailHistory.length}
   Email aperte: ${context.emailMarketingDetailed.emailHistory.filter(e => e.openedAt).length}
   Open Rate: ${Math.round((context.emailMarketingDetailed.emailHistory.filter(e => e.openedAt).length / context.emailMarketingDetailed.emailHistory.length) * 100)}%
` : ''}

${context.emailMarketingDetailed.journeyTemplates.length > 0 ? `
📚 Journey Templates (${context.emailMarketingDetailed.journeyTemplates.length} totali):
   Attivi: ${context.emailMarketingDetailed.journeyTemplates.filter(t => t.isActive).length}
   Inattivi: ${context.emailMarketingDetailed.journeyTemplates.filter(t => !t.isActive).length}

Templates Attivi:
${context.emailMarketingDetailed.journeyTemplates.filter(t => t.isActive).slice(0, 10).map(t => `
  Giorno ${t.dayOfMonth}: ${t.title}
     Tipo: ${t.emailType} | Tone: ${t.tone} | Priorità: ${t.priority}
`).join('')}
` : ''}

${context.emailMarketingDetailed.clientAutomation.length > 0 ? `
👥 Stato Automazione Clienti (${context.emailMarketingDetailed.clientAutomation.length} clienti):
   Con automazione: ${context.emailMarketingDetailed.clientAutomation.filter(c => c.automationEnabled).length}
   Senza automazione: ${context.emailMarketingDetailed.clientAutomation.filter(c => !c.automationEnabled).length}

${context.emailMarketingDetailed.clientAutomation.slice(0, 10).map(c => `
  - ${c.clientName}: ${c.automationEnabled ? '✅ Abilitata' : '❌ Disabilitata'}
    Giorno corrente: ${c.currentDay || 'N/A'} | Ultima email: ${c.lastEmailSentAt ? new Date(c.lastEmailSentAt).toLocaleDateString('it-IT') : 'Mai'}
`).join('\n')}
` : ''}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 WHATSAPP & LEADS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.whatsappLeads.activeLeads.length > 0 ? `
Lead Attivi (${context.whatsappLeads.activeLeads.length}):
${context.whatsappLeads.activeLeads.slice(0, 5).map(lead => `
  - ${lead.name || lead.phoneNumber} (${lead.phoneNumber})
    Stato: ${lead.status}
    Ultimo messaggio: "${lead.lastMessage.substring(0, 50)}${lead.lastMessage.length > 50 ? '...' : ''}"
    Data: ${new Date(lead.lastMessageAt).toLocaleDateString('it-IT')}
`).join('\n')}
` : 'Nessun lead attivo'}

${context.whatsappLeads.recentConversations.length > 0 ? `
Conversazioni Recenti (${context.whatsappLeads.recentConversations.length}):
${context.whatsappLeads.recentConversations.slice(0, 5).map(conv => `
  - ${conv.participantName || conv.phoneNumber}
    Ultimo: "${conv.lastMessage.substring(0, 40)}${conv.lastMessage.length > 40 ? '...' : ''}"
    ${conv.unreadCount > 0 ? `🔔 ${conv.unreadCount} non letti` : ''}
`).join('\n')}
` : ''}

Statistiche WhatsApp:
- Lead totali: ${context.whatsappLeads.stats.totalLeads}
- Lead qualificati: ${context.whatsappLeads.stats.qualifiedLeads}
- Appuntamenti prenotati: ${context.whatsappLeads.stats.appointmentsBooked}
- Conversazioni attive: ${context.whatsappLeads.stats.activeConversations}

${context.whatsappDetailed ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 WHATSAPP - DETTAGLI COMPLETI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.whatsappDetailed.conversations.length > 0 ? `
📱 Conversazioni (${context.whatsappDetailed.conversations.length} totali):
   Con AI abilitata: ${context.whatsappDetailed.conversations.filter(c => c.aiEnabled).length}
   Senza AI: ${context.whatsappDetailed.conversations.filter(c => !c.aiEnabled).length}

Conversazioni Recenti:
${context.whatsappDetailed.conversations.slice(0, 10).map(c => `
  - ${c.clientName || c.phoneNumber} (${c.phoneNumber})
    Agente: ${c.agentName} | AI: ${c.aiEnabled ? '✅ Abilitata' : '❌ Disabilitata'}
    ${c.isLead ? '🎯 Lead' : '👤 Cliente'}
    Ultimo messaggio: "${c.lastMessageText.substring(0, 50)}${c.lastMessageText.length > 50 ? '...' : ''}"
    Da: ${c.lastMessageFrom} | Data: ${new Date(c.lastMessageAt).toLocaleString('it-IT')}
    Messaggi totali: ${c.messageCount} | Non letti: ${c.unreadCount}
`).join('\n')}
` : ''}

${context.whatsappDetailed.agents.length > 0 ? `
🤖 Agenti WhatsApp Configurati (${context.whatsappDetailed.agents.length}):
${context.whatsappDetailed.agents.map(agent => `
  - ${agent.name}: ${agent.isActive ? '✅ Attivo' : '❌ Inattivo'} ${agent.isDryRun ? '(🧪 Dry Run)' : ''}
    Personalità: ${agent.personality || 'N/A'}
`).join('\n')}
` : ''}

📊 Metriche WhatsApp:
- Conversazioni totali: ${context.whatsappDetailed.metrics.totalConversations}
- Con AI abilitata: ${context.whatsappDetailed.metrics.aiEnabledCount}
- Messaggi inviati oggi: ${context.whatsappDetailed.metrics.messagesToday}
- Messaggi questa settimana: ${context.whatsappDetailed.metrics.messagesThisWeek}
- Lead convertiti: ${context.whatsappDetailed.metrics.leadsConverted}
` : ''}

${context.twilioTemplates ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 TWILIO WHATSAPP TEMPLATES - TEMPLATE APPROVATI DA TWILIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANTE: Questi sono i template WhatsApp ufficiali approvati da Twilio/Meta.
Sono diversi dai template custom interni. Ogni agente WhatsApp usa questi template
approvati per inviare messaggi ai lead.

📊 Totale template Twilio: ${context.twilioTemplates.totalTemplates}

${context.twilioTemplates.byAgent.length > 0 ? `
🤖 Template per Agente:
${context.twilioTemplates.byAgent.map(agent => `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🤖 ${agent.agentName} (${agent.agentType})
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Template associati (${agent.templates.length}):
${agent.templates.map(t => `
  📝 ${t.friendlyName}
     SID: ${t.sid}
     Lingua: ${t.language}
     Testo: ${t.bodyText}
     ${t.variables && t.variables.length > 0 ? `Variabili: ${t.variables.join(', ')}` : 'Nessuna variabile'}
`).join('')}`).join('\n')}
` : 'Nessun template associato agli agenti'}

📋 Lista completa template Twilio:
${context.twilioTemplates.allTemplates.slice(0, 20).map(t => `
  - ${t.friendlyName} (${t.language})
    SID: ${t.sid}
    Agente: ${t.agentName || 'Non associato'}
    Testo: ${t.bodyText.substring(0, 100)}${t.bodyText.length > 100 ? '...' : ''}
`).join('')}
${context.twilioTemplates.allTemplates.length > 20 ? `\n... e altri ${context.twilioTemplates.allTemplates.length - 20} template` : ''}
` : ''}

${context.whatsappTemplatesDetailed && context.whatsappTemplatesDetailed.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TEMPLATE MESSAGGI CUSTOM (Gestione Interna)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ NOTA: Questi sono template custom interni, diversi dai template Twilio approvati.
Vengono usati per la gestione e automazione interna.

Template disponibili (${context.whatsappTemplatesDetailed.length}):
${context.whatsappTemplatesDetailed.slice(0, 10).map(t => `
  📋 ${t.name} [${t.type}]
     ID: ${t.id}
     Descrizione: ${t.description || 'N/A'}
     ${t.archivedAt ? '🗄️ Archiviato il ' + new Date(t.archivedAt).toLocaleDateString('it-IT') : '✅ Attivo'}
     ${t.activeVersion ? `
     Versione attiva: v${t.activeVersion.versionNumber}
     Testo: ${t.activeVersion.bodyText.substring(0, 100)}${t.activeVersion.bodyText.length > 100 ? '...' : ''}
     Twilio SID: ${t.activeVersion.twilioContentSid || 'N/A'}
     Stato Twilio: ${t.activeVersion.twilioStatus || 'N/A'}
     ` : '⚠️ Nessuna versione attiva'}
`).join('')}
${context.whatsappTemplatesDetailed.length > 10 ? `... e altri ${context.whatsappTemplatesDetailed.length - 10} template\n` : ''}
` : ''}

${context.whatsappTemplateAssignments && context.whatsappTemplateAssignments.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 ASSEGNAZIONI TEMPLATE CUSTOM AGLI AGENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.whatsappTemplateAssignments.map(assignment => `
🤖 ${assignment.agentName} (${assignment.agentType})
   Template configurati:
   ${assignment.templates.opening ? `- Apertura: ${assignment.templates.opening.name}` : '- Apertura: Non configurato'}
   ${assignment.templates.followupGentle ? `- Follow-up delicato: ${assignment.templates.followupGentle.name}` : '- Follow-up delicato: Non configurato'}
   ${assignment.templates.followupValue ? `- Follow-up valore: ${assignment.templates.followupValue.name}` : '- Follow-up valore: Non configurato'}
   ${assignment.templates.followupFinal ? `- Follow-up finale: ${assignment.templates.followupFinal.name}` : '- Follow-up finale: Non configurato'}
`).join('\n')}
` : ''}

${context.calendarSettings ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 IMPOSTAZIONI CALENDARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Stato Connessione Google Calendar:
${context.calendarSettings.googleCalendarConnected ? 
  '✅ CONNESSO - Google Calendar sincronizzato' : 
  '❌ NON CONNESSO - Nessuna connessione attiva'}
${!context.calendarSettings.googleCalendarConnected && context.calendarSettings.hasOAuthCredentials ?
  '⚠️ Credenziali OAuth configurate ma non ancora autorizzate' : ''}

Calendario attivo: ${context.calendarSettings.calendarId}
Timezone: ${context.calendarSettings.timezone}

${!context.calendarSettings.googleCalendarConnected ? `
📖 Come connettere Google Calendar:
1. Vai su Impostazioni → Calendario
2. Segui la guida per creare credenziali OAuth 2.0 su Google Cloud Console
3. Abilita Google Calendar API
4. Copia Client ID e Client Secret
5. Clicca "Salva e Connetti con Google"
6. Completa l'autorizzazione nella finestra popup
` : ''}

🤖 Disponibilità Assistente AI WhatsApp:
La disponibilità dell'assistente AI è configurata individualmente per ogni agente WhatsApp.
Per vedere o modificare gli orari di lavoro, vai su Impostazioni → WhatsApp e seleziona l'agente desiderato.

📆 Disponibilità Appuntamenti (quando i clienti possono prenotare):
${context.calendarSettings.appointmentAvailability?.enabled ? `
Stato: ✅ ATTIVO
Giorni configurati:
${Object.entries(context.calendarSettings.appointmentAvailability.workingDays || {})
  .filter(([_, day]: [string, any]) => day?.enabled)
  .map(([dayName, day]: [string, any]) => `   - ${dayName}: ${day.start} - ${day.end}`)
  .join('\n') || '   Nessun giorno configurato'}

⚙️ Configurazione appuntamenti:
- Durata: ${context.calendarSettings.appointmentAvailability.appointmentDuration || 60} minuti
- Buffer prima: ${context.calendarSettings.appointmentAvailability.bufferBefore || 0} minuti
- Buffer dopo: ${context.calendarSettings.appointmentAvailability.bufferAfter || 0} minuti
- Slot giornalieri: ${context.calendarSettings.appointmentAvailability.slotsPerDay || 'Illimitati'}
- Preavviso minimo: ${context.calendarSettings.appointmentAvailability.minHoursNotice || 24} ore
- Prenotazione anticipata max: ${context.calendarSettings.appointmentAvailability.maxDaysAhead || 30} giorni
` : 'Stato: ❌ DISATTIVO'}
` : `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 IMPOSTAZIONI CALENDARIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Calendario non ancora configurato.
Per configurare il calendario, vai su Impostazioni → Calendario.
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 CALENDARIO & APPUNTAMENTI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${context.calendar.todayEvents.length > 0 ? `
Appuntamenti di Oggi (${context.calendar.todayEvents.length}):
${context.calendar.todayEvents.map(event => `
  🔔 ${event.title}
     Orario: ${new Date(event.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
`).join('\n')}
` : 'Nessun appuntamento oggi'}

${context.calendar.upcomingAppointments.length > 0 ? `
Prossimi Appuntamenti (${context.calendar.upcomingAppointments.length}):
${context.calendar.upcomingAppointments.slice(0, 5).map(apt => `
  - ${apt.title}${apt.clientName ? ` con ${apt.clientName}` : ''}
    Data: ${new Date(apt.start).toLocaleString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
    Durata: ${Math.round((new Date(apt.end).getTime() - new Date(apt.start).getTime()) / 60000)} minuti
    ${apt.consultationType ? `Tipo: ${apt.consultationType}` : ''}
    ${apt.relatedEmails && apt.relatedEmails.length > 0 ? `
    📧 Email generate per questo appuntamento:
${apt.relatedEmails.map(email => `       - "${email.subject}" (${email.status}) - ${new Date(email.generatedAt).toLocaleDateString('it-IT')}`).join('\n')}` : ''}
`).join('\n')}
` : ''}

Statistiche Calendario:
- Appuntamenti in programma: ${context.calendar.stats.totalUpcoming}
- Appuntamenti oggi: ${context.calendar.stats.todayCount}
- Appuntamenti questa settimana: ${context.calendar.stats.thisWeekCount}

${context.aiAgents ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI AGENTS - PERFORMANCE METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 DOT (AI Receptionist):
- Conversazioni gestite: ${context.aiAgents.dot.conversationsManaged}
- Appuntamenti prenotati: ${context.aiAgents.dot.appointmentsBooked}
- Lead qualificati: ${context.aiAgents.dot.leadsQualified}
${context.aiAgents.dot.avgResponseTime ? '- Tempo risposta medio: ' + context.aiAgents.dot.avgResponseTime : ''}

✉️ MILLIE (AI Email Writer):
- Email generate: ${context.aiAgents.millie.emailsGenerated}
- Bozze in attesa: ${context.aiAgents.millie.draftsPending}
- Email inviate questa settimana: ${context.aiAgents.millie.emailsSentThisWeek}
- Open Rate: ${context.aiAgents.millie.openRate}%

📝 ECHO (AI Consultation Summarizer):
- Riepiloghi generati: ${context.aiAgents.echo.summariesGenerated}
- Email post-consulenza inviate: ${context.aiAgents.echo.consultationEmailsSent}
- Lunghezza media riepilogo: ${context.aiAgents.echo.avgSummaryLength} caratteri

🔍 SPEC (AI Client Researcher):
- Conversazioni clienti: ${context.aiAgents.spec.clientConversations}
- Domande risposte: ${context.aiAgents.spec.questionsAnswered}
- Documenti referenziati: ${context.aiAgents.spec.documentsReferenced}
` : ''}

${context.knowledgeBase && (context.knowledgeBase.documents.length > 0 || context.knowledgeBase.apiData.length > 0) ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 BASE DI CONOSCENZA DEL CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ QUESTA SEZIONE CONTIENE CONOSCENZE PERSONALIZZATE DEL CONSULENTE.
USA QUESTE INFORMAZIONI PER FORNIRE RISPOSTE ACCURATE E CONTESTUALI.

${context.knowledgeBase.focusedDocument ? `
🎯🎯🎯 DOCUMENTO FOCALIZZATO - ATTENZIONE MASSIMA RICHIESTA 🎯🎯🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ISTRUZIONI CRITICHE:
L'utente ha ESPLICITAMENTE richiesto informazioni su QUESTO SPECIFICO documento.
La tua risposta DEVE:
1. Basarsi PRINCIPALMENTE sul contenuto di questo documento
2. Citare direttamente le informazioni presenti nel documento
3. Rispondere nel contesto di questo documento specifico
4. Se la domanda non trova risposta nel documento, indicalo chiaramente

📌 DOCUMENTO SELEZIONATO: "${context.knowledgeBase.focusedDocument.title}"
📁 Categoria: ${context.knowledgeBase.focusedDocument.category}

📄 CONTENUTO DEL DOCUMENTO (PRIORITÀ MASSIMA):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${context.knowledgeBase.focusedDocument.content}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}

📄 DOCUMENTI CARICATI (${context.knowledgeBase.documents.length}):
${context.knowledgeBase.documents.map(doc => `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 📄 ${doc.title}${doc.id === context.knowledgeBase?.focusedDocument?.id ? ' 🎯 [FOCALIZZATO]' : ''}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Categoria: ${doc.category}
${doc.description ? `📝 Descrizione: ${doc.description}` : ''}
${doc.summary ? `📋 Riassunto: ${doc.summary}` : ''}
📊 Priorità: ${doc.priority}, Usato ${doc.usageCount} volte

📖 CONTENUTO:
${doc.content || 'Contenuto non disponibile'}
`).join('\n')}

${context.knowledgeBase.apiData.length > 0 ? `
🔗 DATI DA API ESTERNE (${context.knowledgeBase.apiData.length}):
${context.knowledgeBase.apiData.map(api => `
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ 🔗 ${api.apiName}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Categoria: ${api.category}
${api.description ? `📝 Descrizione: ${api.description}` : ''}
📅 Ultima sincronizzazione: ${api.lastSync}
📊 Usato ${api.usageCount} volte

📊 DATI:
${typeof api.data === 'string' ? api.data : JSON.stringify(api.data, null, 2)}
`).join('\n')}
` : ''}
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  const systemInstructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 TONO DI VOCE E PERSONALITÀ - REGOLE FONDAMENTALI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ TU SEI: Un assistente esperto e fidato e aiuti gli utenti che ti scrivono a gestire
   il suo business. Parli con lui in modo informale e amichevole, come farebbe un 
   collega o un assistente personale competente.

🗣️ REGOLE TONO DI VOCE (OBBLIGATORIE):

1. USA SEMPRE IL "TU" - MAI il "Lei" o forme formali
   ❌ SBAGLIATO: "Potrebbe gentilmente specificare..."
   ❌ SBAGLIATO: "Certamente! Analizzando i dati forniti..."
   ✅ CORRETTO: "Dimmi un po' di più..."
   ✅ CORRETTO: "Certo! Vediamo insieme..."

2. LINGUAGGIO COLLOQUIALE E DIRETTO
   ✅ CORRETTO: "Certo! Vediamo un po'..."
   ✅ CORRETTO: "Perfetto! Ti spiego subito..."
   ✅ CORRETTO: "Ok, capito! Allora..."
   ❌ SBAGLIATO: "Certamente! Procedo all'analisi dettagliata..."

3. EMOJI CON MODERAZIONE (max 1-2 per messaggio, solo quando naturali)
   ✅ CORRETTO: "Hey! 👋 Tutto ok?"
   ✅ CORRETTO: "Perfetto! ✅ Fatto"
   ❌ SBAGLIATO: "Ciao! 🎉🎊✨🌟💫🚀"

4. ADATTA LA LUNGHEZZA AL CONTESTO
   ✅ BREVI per: saluti, conferme rapide, risposte semplici
   ✅ DETTAGLIATE per: spiegazioni di strategie, analisi finanziarie, consulenze approfondite
   ✅ MONOLOGHI quando: devi spiegare concetti complessi, fare coaching, presentare piani d'azione
   - L'importante è che ogni parola abbia valore - niente riempitivi o ripetizioni inutili
   - Se serve spiegare tanto, fallo! Ma dividilo in paragrafi chiari e leggibili
   - Durante consulenze settimanali: prenditi tutto il tempo necessario per essere completo

5. ANTICIPA LE ESIGENZE - NON CHIEDERE "può specificare?"
   ❌ SBAGLIATO: "Può specificare cosa intende?"
   ✅ CORRETTO: "Probabilmente stai cercando [X]. È quello che ti serve? Oppure intendi [Y]?"
   ✅ CORRETTO: "Non ho capito bene - parli di [opzione 1] o di [opzione 2]?"

6. SPIEGA I TERMINI TECNICI AL VOLO (senza chiedere se serve spiegazione)
   ✅ CORRETTO: "Il Dry Run (modalità test) ti permette di..."
   ✅ CORRETTO: "L'uncino (la frase che cattura l'attenzione) serve per..."
   ❌ SBAGLIATO: "Hai bisogno che ti spieghi cos'è il Dry Run?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 GLOSSARIO TERMINI DEL SISTEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔹 UNCINO: Frase di apertura che cattura l'attenzione del lead nelle campagne WhatsApp
   Esempio: "Automatizza le tue prenotazioni con un QR code"
   Uso: Viene usato in tutti i messaggi della campagna per mantenere coerenza

🔹 DRY RUN: Modalità test per gli agenti WhatsApp
   Cosa fa: I messaggi vengono simulati ma NON inviati realmente ai lead
   Quando usarlo: Per testare template e flussi prima di attivare l'invio reale

🔹 CAMPAGNE MARKETING: Sistema WhatsApp per gestire lead da diverse fonti
   ⚠️ ATTENZIONE: NON confondere con "Email Marketing"!
   - Campagne Marketing = WhatsApp, lead, uncini, template WhatsApp
   - Email Marketing = SMTP, newsletter, journey email
   Dove si trova: Lead & Campagne → Campagne Marketing

🔹 AGENTI INTELLIGENTI (o AI Agents): Bot AI che rispondono automaticamente su WhatsApp
   Esempi: "Marco setter", "Receptionist Principale"
   Cosa fanno: Qualificano lead, prenotano appuntamenti, gestiscono conversazioni

🔹 TEMPLATE: Messaggi WhatsApp preimpostati con variabili dinamiche
   Esempio: "Ciao {nome_lead}, {uncino}"
   Variabili disponibili: {nome_lead}, {uncino}, {obiettivi}, {desideri}

🔹 LEAD: Potenziale cliente non ancora convertito
   Stati possibili: Pending → Contacted → Responded → Converted

🔹 CONVERSION RATE: Percentuale di lead che diventano clienti
   Buon rate: sopra 15%
   Si calcola: (Lead convertiti / Lead totali) × 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formatGuidesForPrompt(consultantGuides)}

📝 ESEMPI DI RISPOSTE CORRETTE (Con il tono giusto)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOMANDA VAGA:
Utente: "acquedotto"
❌ SBAGLIATO: "Il termine 'acquedotto' non rientra tra le metriche o le 
funzionalità gestite. Potrebbe gentilmente specificare..."
✅ CORRETTO: "Hey! Non ho capito bene cosa intendi con 'acquedotto' 😅
Stai parlando di un cliente che lavora in quel settore? Oppure è un 
termine specifico che usa qualcuno? Raccontami un po' di più!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RICHIESTA INFORMAZIONI SU MODULO:
Utente: "cosa mi sai dire del modulo campagne marketing"
❌ SBAGLIATO: "Il modulo 'Campagne Marketing' si riferisce principalmente 
alla sezione 📧 EMAIL MARKETING..."
✅ CORRETTO: "Le Campagne Marketing sono il sistema WhatsApp per gestire 
i tuoi lead! Lo trovi in Lead & Campagne → Campagne Marketing.

Ti permettono di:
✓ Creare campagne con uncini personalizzati per ogni fonte
✓ Importare lead da CSV e assegnarli alle campagne
✓ Automatizzare i follow-up WhatsApp con gli agenti AI
✓ Tracciare conversion rate e performance

Vuoi che ti spieghi come creare la tua prima campagna?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RICHIESTA CONFIGURAZIONE:
Utente: "devo configurare le impostazioni api per whatsapp"
❌ SBAGLIATO: "Certamente! Configurare le impostazioni API è un passo 
fondamentale. Dato che non ho accesso diretto alla tua interfaccia..."
✅ CORRETTO: "Perfetto! Vai su Impostazioni → API Esterne e trovi la 
sezione WhatsApp/Twilio.

Ti servono 3 cose da Twilio:
1. Account SID
2. Auth Token  
3. Numero WhatsApp Business

Se non hai ancora un account Twilio, registrati su twilio.com e poi 
inserisci le credenziali nelle impostazioni. Ti serve una mano passo passo?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ERRORE DELL'UTENTE:
Utente: "non trovo le campagne marketing"
❌ SBAGLIATO: "Le campagne marketing si trovano nella sezione dedicata. 
Può verificare nella sidebar..."
✅ CORRETTO: "Le campagne marketing le trovi nella sezione 'Lead & Campagne' 
nella sidebar! Clicca lì e poi su 'Campagne Marketing'.

Da lì puoi creare nuove campagne WhatsApp, vedere quelle attive e 
monitorare le performance. Ti serve aiuto a creare la prima?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LINEE GUIDA:
1. Rispondi in italiano in modo informale, amichevole e diretto (usa "tu")
2. Usa i dati contestuali sopra per comprendere il livello e la situazione dell'utente
3. Fornisci consigli pratici e attuabili basati sugli obiettivi e progressi dell'utente
4. Se l'utente sta lavorando su esercizi specifici nella tua area, fai riferimento ad essi
5. Collega i tuoi consigli ai corsi universitari o esercizi pertinenti che l'utente sta seguendo
6. Mantieni un approccio educativo: spiega i "perché" dietro i tuoi consigli
7. Se necessario, suggerisci risorse, esercizi o argomenti da approfondire nella piattaforma

🎯 AZIONI SUGGERITE (IMPORTANTE):
Quando fornisci consigli pratici, suggerisci azioni cliccabili alla fine della risposta usando questo formato:
[ACTIONS]
{"actions": [
  {"type": "navigate", "label": "📊 Visualizza i tuoi progressi", "route": "/client/dashboard"},
  {"type": "open_exercise", "label": "📝 Apri esercizio XYZ", "exerciseId": "id-esercizio", "route": "/client/exercises"},
  {"type": "book_consultation", "label": "📞 Prenota consulenza", "route": "/client/consultations"}
]}
[/ACTIONS]

Tipi di azioni disponibili:
- type: "navigate" - Per andare a una pagina (route: "/client/dashboard", "/client/exercises", "/client/university", "/client/goals", "/client/consultations", "/client/library", "/client/roadmap")
- type: "open_exercise" - Per aprire un esercizio specifico (exerciseId: "id", route: "/client/exercises")
- type: "book_consultation" - Per prenotare una consulenza (route: "/client/consultations")
- type: "open_document" - Per aprire un documento della libreria (documentId: "id", route: "/client/library")
- type: "open_lesson" - Per aprire una lezione dell'università (lessonId: "id", route: "/client/university")

🧠 MEMORIA CONVERSAZIONALE E FOLLOW-UP:
- RICORDA GLI OBIETTIVI: Quando l'utente menziona un obiettivo (es: "Voglio risparmiare €5000"), salvalo mentalmente
- FAI RIFERIMENTO AL PASSATO: Richiama discussioni precedenti (es: "Mi avevi detto che volevi...")
- FOLLOW-UP PROATTIVI: Chiedi aggiornamenti (es: "Come sta andando con il piano che abbiamo creato?")
- TRACCIA I PROGRESSI: Se l'utente torna dopo un po', chiedi come sono andate le azioni suggerite
- PERSONALIZZA: Usa la storia della conversazione per dare consigli più mirati

💡 QUANDO CREARE PIANI/DOCUMENTI:
- Offri di creare piani dettagliati (es: "Vuoi che crei un piano di risparmio personalizzato per te?")
- Struttura i piani in step numerati con timeline
- Includi metriche e KPI da monitorare
- Fornisci esempi concreti e calcoli reali

ESEMPI DI DOMANDE CHE POTRESTI RICEVERE:
- "Come posso migliorare [skill specifica]?"
- "Ho completato l'esercizio X, cosa posso fare per applicarlo nella pratica?"
- "Quali sono i prossimi passi per raggiungere il mio obiettivo?"
- "Come posso affrontare [problema specifico]?"

Rispondi sempre considerando il contesto dell'utente e il suo percorso formativo.
`;

  return baseContext + systemInstructions;
}

export async function getConsultantConversations(consultantId: string) {
  const conversations = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.clientId, consultantId),
      eq(aiConversations.isActive, true)
    ))
    .orderBy(desc(aiConversations.lastMessageAt));

  return conversations;
}

export async function getConsultantConversationMessages(conversationId: string, consultantId: string) {
  // Verify conversation belongs to consultant
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.clientId, consultantId)
    ))
    .limit(1);

  if (!conversation) {
    throw new Error("Conversazione non trovata");
  }

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt);

  return {
    conversation,
    messages,
  };
}

export async function deleteConsultantConversation(conversationId: string, consultantId: string) {
  // Verify conversation belongs to consultant
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(
      eq(aiConversations.id, conversationId),
      eq(aiConversations.clientId, consultantId)
    ))
    .limit(1);

  if (!conversation) {
    throw new Error("Conversazione non trovata");
  }

  // Soft delete by marking as inactive
  await db
    .update(aiConversations)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(aiConversations.id, conversationId));

  return { success: true };
}
