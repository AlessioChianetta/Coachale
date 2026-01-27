import { db } from "../db";
import { eq } from "drizzle-orm";
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

export async function generateAutopilotBatch(
  config: AutopilotConfig,
  res?: Response
): Promise<{ success: boolean; generated: number; errors: string[] }> {
  const { consultantId, startDate, endDate, platforms } = config;
  const errors: string[] = [];
  let generated = 0;
  
  const sendProgress = (progress: AutopilotProgress) => {
    if (res && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    }
  };
  
  try {
    const [brandAssets] = await db.select()
      .from(schema.brandAssets)
      .where(eq(schema.brandAssets.consultantId, consultantId))
      .limit(1);
    
    const postingSchedule = (brandAssets?.postingSchedule as any) || {};
    
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }
    
    let totalPosts = 0;
    const enabledPlatforms: string[] = [];
    for (const [platform, settings] of Object.entries(platforms)) {
      if (settings?.enabled) {
        totalPosts += dates.length * settings.postsPerDay;
        enabledPlatforms.push(platform);
      }
    }
    
    console.log(`[AUTOPILOT] Starting batch generation: ${totalPosts} posts, ${dates.length} days, platforms: ${enabledPlatforms.join(", ")}`);
    
    for (const date of dates) {
      for (const platform of enabledPlatforms) {
        const platformSettings = platforms[platform as keyof typeof platforms];
        if (!platformSettings?.enabled) continue;
        
        const postsPerDay = platformSettings.postsPerDay;
        
        const scheduleForPlatform = postingSchedule[platform] || {};
        const writingStyle = scheduleForPlatform.writingStyle || PLATFORM_WRITING_STYLES[platform] || "default";
        const times = scheduleForPlatform.times || ["09:00", "18:00"];
        const charLimit = PLATFORM_CHAR_LIMITS[platform] || 2200;
        
        sendProgress({
          total: totalPosts,
          completed: generated,
          currentDate: date,
          currentPlatform: platform,
          status: "running",
        });
        
        try {
          for (let i = 0; i < postsPerDay; i++) {
            const time = times[i] || times[0] || "12:00";
            
            const result = await generateContentIdeas({
              consultantId,
              niche: "content marketing",
              targetAudience: "pubblico target",
              objective: "engagement",
              count: 1,
              mediaType: "photo",
              copyType: platform === "x" ? "short" : "long",
              targetPlatform: platform as "instagram" | "x" | "linkedin",
              writingStyle,
              charLimit,
              awarenessLevel: "problem_aware",
              sophisticationLevel: "level_3",
            });
            
            if (result.ideas && result.ideas.length > 0) {
              const idea = result.ideas[0];
              const dbPlatform = PLATFORM_DB_MAP[platform] || "instagram";
              
              const [insertedPost] = await db.insert(schema.contentPosts).values({
                consultantId,
                title: idea.title,
                hook: idea.suggestedHook || null,
                fullCopy: (idea.structuredContent as any)?.fullCopy || idea.description || "",
                platform: dbPlatform,
                contentType: "post",
                status: "scheduled",
                scheduledAt: new Date(`${date}T${time}:00`),
                mediaType: platform === "x" ? "foto" : "foto",
                copyType: platform === "x" ? "short" : "long",
                structuredContent: idea.structuredContent || {},
              }).returning({ id: schema.contentPosts.id });
              
              // Also create calendar entry for visibility
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
              console.log(`[AUTOPILOT] Generated post ${generated}/${totalPosts} for ${platform} on ${date}`);
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
