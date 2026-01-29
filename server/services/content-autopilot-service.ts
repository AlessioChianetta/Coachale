import { db } from "../db";
import { eq, and, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateContentIdeas } from "./content-ai-service";
import { analyzeAndGenerateImage, AdvisageSettings } from "./advisage-server-service";
import { PublerService } from "./publer-service";
import { Response } from "express";

export interface AutopilotConfig {
  consultantId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  platforms: {
    instagram?: { enabled: boolean; postsPerDay: number; publerAccountId?: string };
    x?: { enabled: boolean; postsPerDay: number; publerAccountId?: string };
    linkedin?: { enabled: boolean; postsPerDay: number; publerAccountId?: string };
  };
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
  
  // New flags for image generation and publishing
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
  status: "running" | "completed" | "error";
  error?: string;
}

const PLATFORM_WRITING_STYLES: Record<string, string> = {
  instagram: "conversational",
  x: "diretto",
  linkedin: "default",
};

// Character limits with 10% safety margin to ensure content fits
const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 1980,  // 2200 * 0.9
  x: 252,           // 280 * 0.9
  linkedin: 2700,   // 3000 * 0.9
};

// X Premium character limit with 10% safety margin
const X_PREMIUM_CHAR_LIMIT = 3600; // 4000 * 0.9

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
    
    // Carica Content Studio Config per Brand Voice Data
    const [contentStudioConfig] = await db.select()
      .from(schema.contentStudioConfig)
      .where(eq(schema.contentStudioConfig.consultantId, consultantId))
      .limit(1);
    
    const brandVoiceData = contentStudioConfig?.brandVoiceData || {};
    const brandVoiceEnabled = contentStudioConfig?.brandVoiceEnabled || false;
    
    // Estrai niche e targetAudience da Brand Voice
    const niche = (brandVoiceData as any)?.businessDescription || 
                  (brandVoiceData as any)?.whatWeDo || 
                  (brandAssets?.chiSono ? "consulenza e formazione" : "content marketing");
    const targetAudience = (brandVoiceData as any)?.whoWeHelp || 
                           (brandAssets?.noteForAi ? "il mio pubblico target" : "pubblico target");
    const objective = (brandVoiceData as any)?.usp ? "leads" : "engagement";
    
    console.log(`[AUTOPILOT] Brand Voice loaded: enabled=${brandVoiceEnabled}, hasData=${Object.keys(brandVoiceData).length > 0}, niche="${niche.substring(0, 50)}...", target="${targetAudience.substring(0, 50)}..."`);
    
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
    
    for (const date of dates) {
      for (const platform of enabledPlatforms) {
        const platformSettings = platforms[platform as keyof typeof platforms];
        if (!platformSettings?.enabled) continue;
        
        const postsPerDay = platformSettings.postsPerDay;
        const dbPlatform = PLATFORM_DB_MAP[platform] || "instagram";
        
        // Get schedule times for this platform
        const scheduleForPlatform = postingSchedule[platform] || {};
        const writingStyle = passedWritingStyle || scheduleForPlatform.writingStyle || PLATFORM_WRITING_STYLES[platform] || "default";
        const times = passedOptimalTimes || scheduleForPlatform.times || OPTIMAL_TIMES[platform] || ["09:00", "18:00"];
        const charLimit = platform === "x" && brandAssets?.xPremiumSubscription 
          ? X_PREMIUM_CHAR_LIMIT 
          : (PLATFORM_CHAR_LIMITS[platform] || 1980);
        
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
          status: "running",
        });
        
        try {
          for (let i = 0; i < effectivePostsPerDay; i++) {
            const time = availableTimeSlots[i] || availableTimeSlots[0] || "12:00";
            const currentContentType = contentTypes[contentTypeIndex % contentTypes.length];
            contentTypeIndex++;
            
            // Mappa "image" → "photo" per allineare con generateContentIdeas che accetta solo "photo" | "video"
            const normalizedMediaType = passedMediaType === "image" ? "photo" : passedMediaType;
            const effectiveMediaType = normalizedMediaType || "photo";
            const effectiveCopyType = passedCopyType || (platform === "x" ? "short" : "long");
            
            // DEBUG: Log tutti i parametri passati a generateContentIdeas
            console.log(`[AUTOPILOT DEBUG] ========================================`);
            console.log(`[AUTOPILOT DEBUG] Calling generateContentIdeas with:`);
            console.log(`[AUTOPILOT DEBUG]   platform: "${platform}"`);
            console.log(`[AUTOPILOT DEBUG]   charLimit: ${charLimit}`);
            console.log(`[AUTOPILOT DEBUG]   copyType: "${effectiveCopyType}"`);
            console.log(`[AUTOPILOT DEBUG]   mediaType: "${effectiveMediaType}"`);
            console.log(`[AUTOPILOT DEBUG]   postSchema: "${postSchema || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   schemaStructure: "${schemaStructure || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   schemaLabel: "${schemaLabel || 'UNDEFINED'}"`);
            console.log(`[AUTOPILOT DEBUG]   writingStyle: "${writingStyle}"`);
            console.log(`[AUTOPILOT DEBUG] ========================================`);
            
            // Retry loop for character limit
            let validIdea: any = null;
            let charLimitRetries = 0;
            
            for (let retry = 0; retry < MAX_CHAR_LIMIT_RETRIES; retry++) {
              const result = await generateContentIdeas({
                consultantId,
                niche,
                targetAudience,
                objective,
                count: 1,
                mediaType: effectiveMediaType,
                copyType: effectiveCopyType,
                targetPlatform: platform as "instagram" | "x" | "linkedin",
                writingStyle,
                charLimit,
                awarenessLevel: (passedAwarenessLevel || "problem_aware") as any,
                sophisticationLevel: (passedSophisticationLevel || "level_3") as any,
                postSchema: postSchema,
                schemaStructure: schemaStructure,
                schemaLabel: schemaLabel,
                postCategory: postCategory,
                customWritingInstructions: customInstructions,
                brandVoiceData: brandVoiceEnabled ? brandVoiceData as any : undefined,
              });
              
              if (result.ideas && result.ideas.length > 0) {
                const idea = result.ideas[0];
                const resolvedFullCopy = (idea.structuredContent as any)?.fullCopy || idea.copyContent || "";
                
                // Check if content exceeds character limit
                if (resolvedFullCopy.length <= charLimit) {
                  validIdea = idea;
                  charLimitRetries = retry;
                  console.log(`[AUTOPILOT] Content within char limit on attempt ${retry + 1}: ${resolvedFullCopy.length}/${charLimit}`);
                  break;
                } else {
                  console.log(`[AUTOPILOT] Content exceeds char limit (${resolvedFullCopy.length}/${charLimit}), retry ${retry + 1}/${MAX_CHAR_LIMIT_RETRIES}`);
                  charLimitRetries = retry + 1;
                  
                  // On last retry, accept the content anyway but log warning
                  if (retry === MAX_CHAR_LIMIT_RETRIES - 1) {
                    console.log(`[AUTOPILOT] Max retries reached, accepting content as-is`);
                    validIdea = idea;
                  }
                }
              }
            }
            
            if (validIdea) {
              const idea = validIdea;
              
              const dbMediaType = effectiveMediaType === "image" ? "foto" : 
                                effectiveMediaType === "video" ? "video" : 
                                effectiveMediaType === "carousel" ? "carosello" : "foto";
              
              const resolvedFullCopy = (idea.structuredContent as any)?.fullCopy || idea.copyContent || "";
              console.log(`[AUTOPILOT DEBUG] Creating post "${idea.title}": fullCopy source=${(idea.structuredContent as any)?.fullCopy ? 'structuredContent' : idea.copyContent ? 'copyContent' : 'empty'}, length=${resolvedFullCopy.length}`);
              
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
      status: "error",
      error: error.message,
    });
    return { success: false, generated, errors: [error.message] };
  }
}
