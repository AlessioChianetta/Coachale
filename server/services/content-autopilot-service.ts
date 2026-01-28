import { db } from "../db";
import { eq, and, gte, lt } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateContentIdeas } from "./content-ai-service";
import { Response } from "express";

export interface AutopilotConfig {
  consultantId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  platforms: {
    instagram?: { enabled: boolean; postsPerDay: number };
    x?: { enabled: boolean; postsPerDay: number };
    linkedin?: { enabled: boolean; postsPerDay: number };
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
}

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

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  x: 280,
  linkedin: 3000,
};

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
  
  try {
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
          ? 4000 
          : (PLATFORM_CHAR_LIMITS[platform] || 2200);
        
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
            
            const effectiveMediaType = passedMediaType || "photo";
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
              
              const dbMediaType = effectiveMediaType === "image" ? "foto" : 
                                effectiveMediaType === "video" ? "video" : 
                                effectiveMediaType === "carousel" ? "carosello" : "foto";
              
              const resolvedFullCopy = (idea.structuredContent as any)?.fullCopy || idea.copyContent || "";
              console.log(`[AUTOPILOT DEBUG] Creating post "${idea.title}": fullCopy source=${(idea.structuredContent as any)?.fullCopy ? 'structuredContent' : idea.copyContent ? 'copyContent' : 'empty'}, length=${resolvedFullCopy.length}`);
              
              const [insertedPost] = await db.insert(schema.contentPosts).values({
                consultantId,
                title: idea.title,
                hook: idea.suggestedHook || null,
                fullCopy: resolvedFullCopy,
                platform: dbPlatform,
                contentType: "post",
                status: "scheduled",
                scheduledAt: new Date(`${date}T${time}:00`),
                mediaType: dbMediaType,
                copyType: effectiveCopyType,
                structuredContent: idea.structuredContent || {},
                aiQualityScore: idea.aiQualityScore || null,
                contentTheme: currentContentType,
              }).returning({ id: schema.contentPosts.id });
              
              if (insertedPost?.id) {
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
              
              generated++;
              console.log(`[AUTOPILOT] Generated post ${generated}/${totalPosts} for ${platform} on ${date} (theme: ${currentContentType})`);
            }
          }
        } catch (error: any) {
          console.error(`[AUTOPILOT] Error generating for ${platform} on ${date}:`, error.message);
          errors.push(`${platform} ${date}: ${error.message}`);
        }
      }
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
