import { db } from "../db";
import { eq, and, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateContentIdeas } from "./content-ai-service";
import { analyzeAndGenerateImage, AdvisageSettings } from "./advisage-server-service";
import { PublerService } from "./publer-service";
import { Response } from "express";

// Per-platform configuration (each platform can have its own settings)
export interface PlatformConfig {
  enabled: boolean;
  postsPerDay: number;
  publerAccountId?: string;
  // Per-platform content settings
  postCategory?: "ads" | "valore" | "formazione" | "altri";
  postSchema?: string;
  schemaStructure?: string;
  schemaLabel?: string;
  mediaType?: "photo" | "video" | "carousel" | "text";
  copyType?: "short" | "long";
  writingStyle?: string;
  charLimit?: number;
}

// Per-day configuration (allows overriding platform settings for specific days)
export interface PerDayConfig {
  date: string;
  postCategory: "ads" | "valore" | "formazione" | "altri";
  postSchema: string;
  schemaStructure?: string;
  schemaLabel?: string;
  mediaType: "photo" | "video" | "carousel" | "text";
  copyType: "short" | "long";
  writingStyle: string;
  hasExistingPosts?: number;
}

export interface AutopilotConfig {
  consultantId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  platforms: {
    instagram?: PlatformConfig;
    x?: PlatformConfig;
    linkedin?: PlatformConfig;
  };
  // Per-day configuration (keyed by date YYYY-MM-DD, then by platform)
  // Structure: perDayConfig[date][platform] = PerDayConfig
  perDayConfig?: Record<string, Record<string, PerDayConfig>>;
  // Global fallback values (used when platform-specific values are not set)
  postSchema?: string;
  schemaStructure?: string;
  schemaLabel?: string;
  postCategory?: string;
  contentTypes?: string[];
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  excludedDates?: string[];
  writingStyle?: string;
  customInstructions?: string;
  optimalTimes?: string[];
  mediaType?: string;
  copyType?: string;
  awarenessLevel?: string;
  sophisticationLevel?: string;
  
  // Parameters from manual generation form (unified with generateContentIdeas)
  niche?: string;
  targetAudience?: string;
  objective?: string;
  brandVoiceData?: any;
  kbContent?: string;
  charLimit?: number;
  
  // Flags for image generation and publishing
  autoGenerateImages?: boolean;
  autoPublish?: boolean;
  reviewMode?: boolean;
  advisageSettings?: AdvisageSettings;
}

const MAX_CHAR_LIMIT_RETRIES = 3;

export interface AutopilotProgress {
  total: number;
  completed: number;
  currentDate: string;
  currentPlatform: string;
  currentDayIndex: number;
  totalDays: number;
  status: "running" | "completed" | "error";
  error?: string;
}

const PLATFORM_WRITING_STYLES: Record<string, string> = {
  instagram: "conversational",
  x: "diretto",
  linkedin: "default",
};

// Limits to pass to AI prompt (with 10% safety margin to "trick" AI into shorter content)
const PLATFORM_CHAR_LIMITS_FOR_AI: Record<string, number> = {
  instagram: 1980,  // Real: 2200
  linkedin: 2700,   // Real: 3000
  x: 252,           // Real: 280
};
const X_PREMIUM_CHAR_LIMIT_FOR_AI = 3600; // Real: 4000

// Real limits for accepting content (actual platform limits)
const PLATFORM_CHAR_LIMITS_REAL: Record<string, number> = {
  instagram: 2200,
  linkedin: 3000,
  x: 280,
};
const X_PREMIUM_CHAR_LIMIT_REAL = 4000;

const PLATFORM_DB_MAP: Record<string, "instagram" | "facebook" | "linkedin" | "twitter" | "tiktok" | "youtube"> = {
  instagram: "instagram",
  x: "twitter",
  linkedin: "linkedin",
};

const OPTIMAL_TIMES: Record<string, string[]> = {
  instagram: ["11:00", "14:00", "19:00"],
  x: ["09:00", "12:00", "17:00"],
  linkedin: ["08:00", "12:00", "17:30"],
};

const DEFAULT_CONTENT_TYPES = ["educativo", "promozionale", "storytelling", "behind-the-scenes"];

const ITALIAN_HOLIDAYS = [
  "2024-01-01", "2024-01-06", "2024-03-31", "2024-04-01",
  "2024-04-25", "2024-05-01", "2024-06-02", "2024-08-15",
  "2024-11-01", "2024-12-08", "2024-12-25", "2024-12-26",
  "2025-01-01", "2025-01-06", "2025-04-20", "2025-04-21",
  "2025-04-25", "2025-05-01", "2025-06-02", "2025-08-15",
  "2025-11-01", "2025-12-08", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-01-06", "2026-04-05", "2026-04-06",
  "2026-04-25", "2026-05-01", "2026-06-02", "2026-08-15",
  "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26"
];

function isWeekend(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(dateStr: string): boolean {
  return ITALIAN_HOLIDAYS.includes(dateStr);
}

export async function generateAutopilotBatch(
  config: AutopilotConfig,
  res?: Response
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const { 
    consultantId, 
    startDate, 
    endDate, 
    platforms,
    postSchema,
    schemaStructure,
    schemaLabel,
    postCategory,
    contentTypes = DEFAULT_CONTENT_TYPES,
    excludeWeekends = false,
    excludeHolidays = false,
    excludedDates = [],
    writingStyle: passedWritingStyle,
    customInstructions,
    optimalTimes: passedOptimalTimes,
    mediaType: passedMediaType,
    copyType: passedCopyType,
    awarenessLevel: passedAwarenessLevel,
    sophisticationLevel: passedSophisticationLevel,
  } = config;
  
  const errors: string[] = [];
  let generated = 0;
  let contentTypeIndex = 0;
  
  const sendProgress = (progress: AutopilotProgress) => {
    if (res && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    }
  };
  
  // Batch tracking variables
  let batchId: string | null = null;
  let imagesGenerated = 0;
  
  // Track generated posts for autoPublish
  const generatedPosts: Array<{
    id: string;
    platform: string;
    scheduledAt: Date;
    imageUrl?: string;
  }> = [];
  
  try {
    // Step 1: Create batch record if reviewMode or autoGenerateImages is enabled
    if (config.reviewMode || config.autoGenerateImages) {
      const [batch] = await db.insert(schema.autopilotBatches).values({
        consultantId,
        config: config as any,
        autoGenerateImages: config.autoGenerateImages || false,
        autoPublish: config.autoPublish || false,
        reviewMode: config.reviewMode || false,
        advisageSettings: config.advisageSettings || { mood: 'professional', stylePreference: 'realistic' },
        status: "generating",
        totalPosts: 0,
        generatedPosts: 0,
        imagesGenerated: 0,
        approvedPosts: 0,
        publishedPosts: 0,
        failedPosts: 0,
      }).returning({ id: schema.autopilotBatches.id });
      
      batchId = batch?.id || null;
      console.log(`[AUTOPILOT] Created batch ${batchId} with reviewMode=${config.reviewMode}, autoGenerateImages=${config.autoGenerateImages}`);
    }
    
    // Carica Brand Assets per postingSchedule e X Premium
    const [brandAssets] = await db.select()
      .from(schema.brandAssets)
      .where(eq(schema.brandAssets.consultantId, consultantId))
      .limit(1);
    
    // Use parameters passed from form, or fallback to Content Studio Config
    let brandVoiceData = config.brandVoiceData;
    let brandVoiceEnabled = !!brandVoiceData && Object.keys(brandVoiceData).length > 0;
    
    // If no brandVoiceData passed, load from Content Studio Config
    if (!brandVoiceData) {
      const [contentStudioConfig] = await db.select()
        .from(schema.contentStudioConfig)
        .where(eq(schema.contentStudioConfig.consultantId, consultantId))
        .limit(1);
      
      brandVoiceData = contentStudioConfig?.brandVoiceData || {};
      brandVoiceEnabled = contentStudioConfig?.brandVoiceEnabled || false;
    }
    
    // Use passed parameters with fallback to Brand Voice data
    const niche = config.niche || 
                  (brandVoiceData as any)?.businessDescription || 
                  (brandVoiceData as any)?.whatWeDo || 
                  (brandAssets?.chiSono ? "consulenza e formazione" : "content marketing");
    const targetAudience = config.targetAudience || 
                           (brandVoiceData as any)?.whoWeHelp || 
                           (brandAssets?.noteForAi ? "il mio pubblico target" : "pubblico target");
    const objective = config.objective || 
                      ((brandVoiceData as any)?.usp ? "leads" : "engagement");
    
    // Use passed kbContent if available
    const kbContent = config.kbContent;
    
    console.log(`[AUTOPILOT] Parameters: niche="${(niche || "").substring(0, 50)}...", target="${(targetAudience || "").substring(0, 50)}...", objective="${objective}", hasKbContent=${!!kbContent}, brandVoiceEnabled=${brandVoiceEnabled}`);
    
    const postingSchedule = (brandAssets?.postingSchedule as any) || {};
    
    const allDates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split("T")[0]);
    }
    
    const dates = allDates.filter(dateStr => {
      if (excludeWeekends && isWeekend(dateStr)) return false;
      if (excludeHolidays && isHoliday(dateStr)) return false;
      if (excludedDates.includes(dateStr)) return false;
      return true;
    });
    
    let totalPosts = 0;
    const enabledPlatforms: string[] = [];
    for (const [platform, settings] of Object.entries(platforms)) {
      if (settings?.enabled) {
        totalPosts += dates.length * settings.postsPerDay;
        enabledPlatforms.push(platform);
      }
    }
    
    console.log(`[AUTOPILOT] Starting batch generation: ${totalPosts} posts, ${dates.length} days (filtered from ${allDates.length}), platforms: ${enabledPlatforms.join(", ")}`);
    
    const totalDays = dates.length;
    
    for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
      const date = dates[dayIndex];
      
      for (const platform of enabledPlatforms) {
        // Get per-day, per-platform configuration if available
        const dayConfig = config.perDayConfig?.[date]?.[platform];
        const platformSettings = platforms[platform as keyof typeof platforms];
        if (!platformSettings?.enabled) continue;
        
        const postsPerDay = platformSettings.postsPerDay;
        const dbPlatform = PLATFORM_DB_MAP[platform] || "instagram";
        
        // ===== USE PER-DAY CONFIG > PER-PLATFORM CONFIG > global fallback =====
        // Priority: dayConfig value > platformSettings value > global config value > default
        const platformWritingStyle = dayConfig?.writingStyle || platformSettings.writingStyle || passedWritingStyle;
        const platformPostCategory = dayConfig?.postCategory || platformSettings.postCategory || postCategory || "ads";
        const platformPostSchema = dayConfig?.postSchema || platformSettings.postSchema || postSchema;
        const platformSchemaStructure = dayConfig?.schemaStructure || platformSettings.schemaStructure || schemaStructure;
        const platformSchemaLabel = dayConfig?.schemaLabel || platformSettings.schemaLabel || schemaLabel;
        const platformMediaType = dayConfig?.mediaType || platformSettings.mediaType || passedMediaType;
        const platformCopyType = dayConfig?.copyType || platformSettings.copyType || passedCopyType;
        const platformCharLimit = platformSettings.charLimit;
        
        // Get schedule times for this platform
        const scheduleForPlatform = postingSchedule[platform] || {};
        const writingStyle = platformWritingStyle || scheduleForPlatform.writingStyle || PLATFORM_WRITING_STYLES[platform] || "default";
        const times = passedOptimalTimes || scheduleForPlatform.times || OPTIMAL_TIMES[platform] || ["09:00", "18:00"];
        
        // Char limit for AI prompt (with safety margin to encourage shorter content)
        // If per-platform charLimit passed, calculate AI limit as 90% of it
        let charLimitForAI: number;
        let charLimitReal: number;
        if (platformCharLimit) {
          charLimitReal = platformCharLimit;
          charLimitForAI = Math.floor(platformCharLimit * 0.9);
        } else if (platform === "x" && brandAssets?.xPremiumSubscription) {
          charLimitForAI = X_PREMIUM_CHAR_LIMIT_FOR_AI;
          charLimitReal = X_PREMIUM_CHAR_LIMIT_REAL;
        } else {
          charLimitForAI = PLATFORM_CHAR_LIMITS_FOR_AI[platform] || 1980;
          charLimitReal = PLATFORM_CHAR_LIMITS_REAL[platform] || 2200;
        }
        
        // Fetch ALL existing SCHEDULED posts for this day/platform to check which time slots are occupied
        // Only count posts with status "scheduled" - not drafts, published, or cancelled
        const dayStart = new Date(`${date}T00:00:00`);
        const dayEnd = new Date(`${date}T23:59:59`);
        const existingPosts = await db.select({ 
          id: schema.contentPosts.id,
          scheduledAt: schema.contentPosts.scheduledAt 
        })
          .from(schema.contentPosts)
          .where(and(
            eq(schema.contentPosts.consultantId, consultantId),
            eq(schema.contentPosts.platform, dbPlatform),
            eq(schema.contentPosts.status, "scheduled"),
            gte(schema.contentPosts.scheduledAt, dayStart),
            lt(schema.contentPosts.scheduledAt, dayEnd)
          ));
        
        // Extract occupied time slots (HH:MM format)
        const occupiedTimeSlots = new Set<string>();
        for (const post of existingPosts) {
          if (post.scheduledAt) {
            const postTime = new Date(post.scheduledAt);
            const hours = postTime.getHours().toString().padStart(2, '0');
            const minutes = postTime.getMinutes().toString().padStart(2, '0');
            occupiedTimeSlots.add(`${hours}:${minutes}`);
          }
        }
        
        // Filter available time slots (not already occupied)
        const availableTimeSlots = times.filter(time => !occupiedTimeSlots.has(time));
        
        if (availableTimeSlots.length === 0) {
          console.log(`[AUTOPILOT] Skipping ${platform} on ${date} - all ${times.length} time slots already occupied`);
          continue;
        }
        
        if (occupiedTimeSlots.size > 0) {
          console.log(`[AUTOPILOT] ${platform} on ${date}: ${occupiedTimeSlots.size} slots occupied, ${availableTimeSlots.length} available`);
        }
        
        // Limit postsPerDay to available slots
        const effectivePostsPerDay = Math.min(postsPerDay, availableTimeSlots.length);
        
        sendProgress({
          total: totalPosts,
          completed: generated,
          currentDate: date,
          currentPlatform: platform,
          currentDayIndex: dayIndex + 1,
          totalDays: totalDays,
          status: "running",
        });
        
        try {
          for (let i = 0; i < effectivePostsPerDay; i++) {
            const time = availableTimeSlots[i] || availableTimeSlots[0] || "12:00";
            const currentContentType = contentTypes[contentTypeIndex % contentTypes.length];
            contentTypeIndex++;
            
            // Mappa mediaType per allineare con generateContentIdeas che accetta solo "photo" | "video"
            // "carousel" e "text" non sono supportati da AI, mappiamo a "photo"
            const originalMediaType = platformMediaType || "photo";
            let aiMediaType: "photo" | "video" = "photo";
            if (originalMediaType === "video") {
              aiMediaType = "video";
            } else {
              // "photo", "carousel", "text", "image" → "photo" per AI
              aiMediaType = "photo";
            }
            const effectiveCopyType = (platformCopyType || (platform === "x" ? "short" : "long")) as "short" | "long";
            
            // DEBUG: Log tutti i parametri passati a generateContentIdeas (using per-platform values)
            console.log(`[AUTOPILOT DEBUG] ========================================`);
            console.log(`[AUTOPILOT DEBUG] Calling generateContentIdeas for ${platform}:`);
            console.log(`[AUTOPILOT DEBUG]   charLimitForAI: ${charLimitForAI}, charLimitReal: ${charLimitReal}`);
            console.log(`[AUTOPILOT DEBUG]   copyType: "${effectiveCopyType}" (platform: ${platformCopyType})`);
            console.log(`[AUTOPILOT DEBUG]   mediaType: "${aiMediaType}" (original: ${originalMediaType}, platform: ${platformMediaType})`);
            console.log(`[AUTOPILOT DEBUG]   postSchema: "${platformPostSchema || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   schemaStructure: "${platformSchemaStructure || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   schemaLabel: "${platformSchemaLabel || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   postCategory: "${platformPostCategory}"`);
            console.log(`[AUTOPILOT DEBUG]   writingStyle: "${writingStyle}"`);
            console.log(`[AUTOPILOT DEBUG] ========================================`);
            
            // Retry loop for character limit
            let validIdea: any = null;
            let charLimitRetries = 0;
            let previousLength = 0;
            
            for (let retry = 0; retry < MAX_CHAR_LIMIT_RETRIES; retry++) {
              // Build retry feedback for customWritingInstructions
              let retryFeedback = customInstructions || "";
              if (retry > 0 && previousLength > 0) {
                const feedbackMsg = `\n\n⚠️ Il tentativo precedente era ${previousLength} caratteri. Riscrivi con MASSIMO ${charLimitReal} caratteri. Se superi, la risposta verrà scartata.`;
                retryFeedback = retryFeedback ? retryFeedback + feedbackMsg : feedbackMsg;
              }
              
              const result = await generateContentIdeas({
                consultantId,
                niche,
                targetAudience,
                objective,
                count: 1,
                mediaType: aiMediaType,
                copyType: effectiveCopyType,
                targetPlatform: platform as "instagram" | "x" | "linkedin",
                writingStyle,
                charLimit: charLimitForAI,
                awarenessLevel: (passedAwarenessLevel || "problem_aware") as any,
                sophisticationLevel: (passedSophisticationLevel || "level_3") as any,
                postSchema: platformPostSchema,
                schemaStructure: platformSchemaStructure,
                schemaLabel: platformSchemaLabel,
                postCategory: platformPostCategory,
                customWritingInstructions: retryFeedback || undefined,
                brandVoiceData: brandVoiceEnabled ? brandVoiceData as any : undefined,
                kbContent: kbContent || undefined,
              });
              
              if (result.ideas && result.ideas.length > 0) {
                const idea = result.ideas[0];
                const sc = idea.structuredContent as any;
                const resolvedFullCopy = sc?.captionCopy || sc?.fullCopy || idea.copyContent || "";
                previousLength = resolvedFullCopy.length;
                
                // Check if content exceeds character limit (use real platform limits)
                if (resolvedFullCopy.length <= charLimitReal) {
                  validIdea = idea;
                  charLimitRetries = retry;
                  console.log(`[AUTOPILOT] Content within char limit on attempt ${retry + 1}: ${resolvedFullCopy.length}/${charLimitReal}`);
                  break;
                } else {
                  console.log(`[AUTOPILOT] Content exceeds char limit (${resolvedFullCopy.length}/${charLimitReal}), retry ${retry + 1}/${MAX_CHAR_LIMIT_RETRIES}`);
                  charLimitRetries = retry + 1;
                  
                  // On last retry, accept the content as-is (no truncation)
                  if (retry === MAX_CHAR_LIMIT_RETRIES - 1) {
                    console.log(`[AUTOPILOT] Max retries reached, saving content as-is (${resolvedFullCopy.length} chars)`);
                    validIdea = idea;
                  }
                }
              }
            }
            
            if (validIdea) {
              const idea = validIdea;
              
              // Usa originalMediaType per il database (mantiene carousel, text, etc.)
              const dbMediaType = originalMediaType === "image" ? "foto" : 
                                originalMediaType === "video" ? "video" : 
                                originalMediaType === "carousel" ? "carosello" : 
                                originalMediaType === "text" ? "testo" : "foto";
              
              const sc = idea.structuredContent as any;
              const resolvedFullCopy = sc?.captionCopy || sc?.fullCopy || idea.copyContent || "";
              
              // Log if content exceeds limit (no truncation, save as-is)
              if (resolvedFullCopy.length > charLimitReal) {
                console.log(`[AUTOPILOT] Content exceeds real limit but saving as-is: ${resolvedFullCopy.length}/${charLimitReal} chars`);
              }
              
              console.log(`[AUTOPILOT DEBUG] Creating post "${idea.title}": captionCopy source=${sc?.captionCopy ? 'structuredContent' : idea.copyContent ? 'copyContent' : 'empty'}, length=${resolvedFullCopy.length}`);
              
              // Determine initial status based on reviewMode
              const postStatus = config.reviewMode ? "draft" : "scheduled";
              const reviewStatus = config.reviewMode ? "pending" : undefined;
              
              const [insertedPost] = await db.insert(schema.contentPosts).values({
                consultantId,
                title: idea.title,
                hook: idea.suggestedHook || null,
                fullCopy: resolvedFullCopy,
                platform: dbPlatform,
                contentType: "post",
                status: postStatus,
                scheduledAt: new Date(`${date}T${time}:00`),
                mediaType: dbMediaType,
                copyType: effectiveCopyType,
                structuredContent: idea.structuredContent || {},
                aiQualityScore: idea.aiQualityScore || null,
                contentTheme: currentContentType,
                generatedBy: "autopilot",
                // Autopilot batch fields
                autopilotBatchId: batchId,
                imageGenerationStatus: config.autoGenerateImages ? "pending" : "skipped",
                reviewStatus: reviewStatus,
                charLimitRetries: charLimitRetries,
              }).returning({ id: schema.contentPosts.id });
              
              if (insertedPost?.id) {
                // Only create calendar entry if not in review mode
                if (!config.reviewMode) {
                  await db.insert(schema.contentCalendar).values({
                    consultantId,
                    postId: insertedPost.id,
                    scheduledDate: date,
                    scheduledTime: time,
                    title: idea.title,
                    platform: dbPlatform,
                    contentType: "post",
                    status: "scheduled",
                  });
                }
                
                // Step 2d: If autoGenerateImages is enabled, generate image with AdVisage
                if (config.autoGenerateImages) {
                  try {
                    console.log(`[AUTOPILOT] Generating image for post ${insertedPost.id}...`);
                    
                    // Update status to generating
                    await db.update(schema.contentPosts)
                      .set({ imageGenerationStatus: "generating" })
                      .where(eq(schema.contentPosts.id, insertedPost.id));
                    
                    const advisageSettings = config.advisageSettings || {
                      mood: 'professional' as const,
                      stylePreference: 'realistic' as const,
                    };
                    
                    const imageResult = await analyzeAndGenerateImage(
                      consultantId,
                      resolvedFullCopy,
                      platform,
                      advisageSettings
                    );
                    
                    if (imageResult.imageUrl && !imageResult.error) {
                      // Get image prompt from analysis
                      const imagePrompt = imageResult.analysis?.concepts?.[0]?.promptClean || 
                                          imageResult.analysis?.concepts?.[0]?.description || "";
                      const imageDescription = imageResult.analysis?.concepts?.[0]?.title || "";
                      
                      await db.update(schema.contentPosts)
                        .set({ 
                          imageUrl: imageResult.imageUrl,
                          imagePrompt: imagePrompt,
                          imageDescription: imageDescription,
                          imageGenerationStatus: "completed",
                          imageGeneratedAt: new Date(),
                        })
                        .where(eq(schema.contentPosts.id, insertedPost.id));
                      
                      imagesGenerated++;
                      console.log(`[AUTOPILOT] Image generated successfully for post ${insertedPost.id}`);
                    } else {
                      // Image generation failed
                      await db.update(schema.contentPosts)
                        .set({ 
                          imageGenerationStatus: "failed",
                          imageGenerationError: imageResult.error || "Unknown error",
                        })
                        .where(eq(schema.contentPosts.id, insertedPost.id));
                      
                      console.log(`[AUTOPILOT] Image generation failed for post ${insertedPost.id}: ${imageResult.error}`);
                    }
                  } catch (imageError: any) {
                    console.error(`[AUTOPILOT] Image generation error for post ${insertedPost.id}:`, imageError.message);
                    await db.update(schema.contentPosts)
                      .set({ 
                        imageGenerationStatus: "failed",
                        imageGenerationError: imageError.message,
                      })
                      .where(eq(schema.contentPosts.id, insertedPost.id));
                  }
                }
                
                // Track post for autoPublish - get current image URL from DB
                const [currentPost] = await db.select({ imageUrl: schema.contentPosts.imageUrl })
                  .from(schema.contentPosts)
                  .where(eq(schema.contentPosts.id, insertedPost.id))
                  .limit(1);
                
                generatedPosts.push({
                  id: insertedPost.id,
                  platform: platform,
                  scheduledAt: new Date(`${date}T${time}:00`),
                  imageUrl: currentPost?.imageUrl || undefined,
                });
              }
              
              generated++;
              console.log(`[AUTOPILOT] Generated post ${generated}/${totalPosts} for ${platform} on ${date} (theme: ${currentContentType}, retries: ${charLimitRetries})`);
            }
          }
        } catch (error: any) {
          console.error(`[AUTOPILOT] Error generating for ${platform} on ${date}:`, error.message);
          errors.push(`${platform} ${date}: ${error.message}`);
        }
      }
    }
    
    // Step 3: Update batch with final counts
    if (batchId) {
      const batchStatus = config.reviewMode ? "awaiting_review" : 
                          (config.autoPublish ? "publishing" : "approved");
      
      await db.update(schema.autopilotBatches)
        .set({
          status: batchStatus,
          totalPosts: generated,
          generatedPosts: generated,
          imagesGenerated: imagesGenerated,
          approvedPosts: config.reviewMode ? 0 : generated,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.autopilotBatches.id, batchId));
      
      console.log(`[AUTOPILOT] Batch ${batchId} completed: ${generated} posts, ${imagesGenerated} images, status=${batchStatus}`);
    }
    
    // Step 4: AutoPublish flow - if autoPublish is enabled and not in review mode
    let publishedCount = 0;
    let publishErrors: string[] = [];
    
    if (config.autoPublish && !config.reviewMode && generatedPosts.length > 0) {
      console.log(`[AUTOPILOT] Starting autoPublish for ${generatedPosts.length} posts...`);
      
      const publerService = new PublerService();
      
      // Group posts by platform to batch publish
      for (const post of generatedPosts) {
        const platformConfig = platforms[post.platform as keyof typeof platforms];
        const publerAccountId = platformConfig?.publerAccountId;
        
        if (!publerAccountId) {
          console.log(`[AUTOPILOT] Skipping autoPublish for post ${post.id} - no publerAccountId configured for ${post.platform}`);
          continue;
        }
        
        try {
          console.log(`[AUTOPILOT] Publishing post ${post.id} to Publer account ${publerAccountId}...`);
          
          // Get full post content
          const [fullPost] = await db.select()
            .from(schema.contentPosts)
            .where(eq(schema.contentPosts.id, post.id))
            .limit(1);
          
          if (!fullPost) {
            console.error(`[AUTOPILOT] Post ${post.id} not found for publishing`);
            continue;
          }
          
          // Upload media if available
          let mediaIds: string[] = [];
          if (fullPost.imageUrl) {
            try {
              // If imageUrl is a local path, we need to upload it
              // For now, check if it's already a Publer media ID or needs upload
              if (!fullPost.imageUrl.startsWith('http')) {
                console.log(`[AUTOPILOT] Uploading image for post ${post.id}...`);
                // Read image file and upload to Publer
                const fs = await import('fs/promises');
                const path = await import('path');
                const imagePath = path.join(process.cwd(), fullPost.imageUrl);
                const imageBuffer = await fs.readFile(imagePath);
                const mediaResult = await publerService.uploadMedia(
                  consultantId,
                  imageBuffer,
                  `autopilot_${post.id}.png`,
                  'image/png'
                );
                mediaIds = [mediaResult.id];
              }
            } catch (uploadError: any) {
              console.error(`[AUTOPILOT] Failed to upload image for post ${post.id}:`, uploadError.message);
              // Continue without image - use placeholder for Instagram
              if (post.platform === 'instagram') {
                try {
                  const placeholderResult = await publerService.uploadPlaceholderImage(consultantId);
                  mediaIds = [placeholderResult.id];
                } catch (placeholderError: any) {
                  console.error(`[AUTOPILOT] Failed to upload placeholder:`, placeholderError.message);
                }
              }
            }
          } else if (post.platform === 'instagram') {
            // Instagram requires media - upload placeholder
            try {
              console.log(`[AUTOPILOT] No image for Instagram post ${post.id}, uploading placeholder...`);
              const placeholderResult = await publerService.uploadPlaceholderImage(consultantId);
              mediaIds = [placeholderResult.id];
            } catch (placeholderError: any) {
              console.error(`[AUTOPILOT] Failed to upload placeholder for Instagram:`, placeholderError.message);
              publishErrors.push(`Post ${post.id}: Instagram requires image but placeholder upload failed`);
              continue;
            }
          }
          
          // Schedule with Publer
          const result = await publerService.schedulePost(consultantId, {
            accountIds: [publerAccountId],
            text: fullPost.fullCopy || fullPost.hook || fullPost.title || '',
            state: 'scheduled',
            scheduledAt: post.scheduledAt,
            mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
            mediaType: 'image',
          });
          
          if (result.success) {
            // Update post with Publer info
            await db.update(schema.contentPosts)
              .set({
                publerPostId: result.postIds?.[0] || result.jobId,
                publerStatus: 'scheduled',
                publerScheduledAt: post.scheduledAt,
                publerMediaIds: mediaIds as any,
                status: 'scheduled',
              })
              .where(eq(schema.contentPosts.id, post.id));
            
            publishedCount++;
            console.log(`[AUTOPILOT] Successfully scheduled post ${post.id} to Publer (job: ${result.jobId})`);
          } else {
            // Update post with error
            const errorMsg = result.errors?.join(', ') || 'Unknown error';
            await db.update(schema.contentPosts)
              .set({
                publerStatus: 'failed',
                publerError: errorMsg,
              })
              .where(eq(schema.contentPosts.id, post.id));
            
            publishErrors.push(`Post ${post.id}: ${errorMsg}`);
            console.error(`[AUTOPILOT] Failed to schedule post ${post.id}:`, errorMsg);
          }
        } catch (publishError: any) {
          console.error(`[AUTOPILOT] Exception publishing post ${post.id}:`, publishError.message);
          publishErrors.push(`Post ${post.id}: ${publishError.message}`);
          
          await db.update(schema.contentPosts)
            .set({
              publerStatus: 'failed',
              publerError: publishError.message,
            })
            .where(eq(schema.contentPosts.id, post.id));
        }
      }
      
      console.log(`[AUTOPILOT] AutoPublish completed: ${publishedCount}/${generatedPosts.length} posts scheduled, ${publishErrors.length} errors`);
      
      // Update batch with publish results
      if (batchId) {
        await db.update(schema.autopilotBatches)
          .set({
            status: publishErrors.length === 0 ? "completed" : "completed_with_errors",
            publishedPosts: publishedCount,
            failedPosts: publishErrors.length,
            lastError: publishErrors.length > 0 ? publishErrors.join('; ') : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.autopilotBatches.id, batchId));
      }
      
      // Add publish errors to main errors array
      errors.push(...publishErrors);
    }
    
    sendProgress({
      total: totalPosts,
      completed: generated,
      currentDate: endDate,
      currentPlatform: "completed",
      currentDayIndex: totalDays,
      totalDays: totalDays,
      status: "completed",
    });
    
    return { success: true, generated, errors };
  } catch (error: any) {
    console.error("[AUTOPILOT] Fatal error:", error.message);
    
    // Update batch status to failed if batch was created
    if (batchId) {
      await db.update(schema.autopilotBatches)
        .set({
          status: "failed",
          failedPosts: generated > 0 ? 1 : 0,
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(schema.autopilotBatches.id, batchId));
    }
    
    sendProgress({
      total: 0,
      completed: 0,
      currentDate: "",
      currentPlatform: "",
      currentDayIndex: 0,
      totalDays: 0,
      status: "error",
      error: error.message,
    });
    return { success: false, generated, errors: [error.message] };
  }
}
