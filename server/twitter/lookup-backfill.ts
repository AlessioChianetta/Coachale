/**
 * Twitter DM Backfill Service
 * Polls DM events as a fallback when webhooks are unavailable
 * Implements idempotent event processing using twitter_processed_events table
 */

import { pool } from "../db";
import { TwitterClient } from "./twitter-client";
import { TwitterDMEventV2 } from "./types";

export interface ProcessedEvent {
  eventId: string;
  eventType: string;
  consultantId?: string;
  configId?: string;
  processedAt: Date;
}

/**
 * TwitterDMBackfill class for polling DM events as webhook fallback
 * Ensures idempotent processing of DM events
 */
export class TwitterDMBackfill {
  private processedEventCache: Map<string, boolean> = new Map();
  private cacheInitialized: boolean = false;

  /**
   * Initialize cache by loading processed events from database
   * Called once per instance to optimize repeated checks
   */
  private async initializeCache(): Promise<void> {
    if (this.cacheInitialized) return;

    try {
      const result = await pool.query(
        "SELECT event_id FROM twitter_processed_events LIMIT 10000"
      );
      
      result.rows.forEach((row: any) => {
        this.processedEventCache.set(row.event_id, true);
      });
      
      this.cacheInitialized = true;
      console.log(
        `✅ [TWITTER BACKFILL] Initialized cache with ${result.rows.length} processed events`
      );
    } catch (error) {
      console.warn(
        `⚠️ [TWITTER BACKFILL] Failed to initialize cache, will check DB per event:`,
        error
      );
      this.cacheInitialized = true; // Mark as initialized to prevent repeated attempts
    }
  }

  /**
   * Check if an event has been processed
   * @param eventId - The Twitter DM event ID
   * @returns true if event has been processed, false otherwise
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    await this.initializeCache();

    // Check cache first
    if (this.processedEventCache.has(eventId)) {
      return true;
    }

    // Check database
    try {
      const result = await pool.query(
        "SELECT 1 FROM twitter_processed_events WHERE event_id = $1 LIMIT 1",
        [eventId]
      );
      
      const isProcessed = result.rows.length > 0;
      
      // Update cache
      if (isProcessed) {
        this.processedEventCache.set(eventId, true);
      }
      
      return isProcessed;
    } catch (error) {
      console.error(`❌ [TWITTER BACKFILL] Error checking if event ${eventId} is processed:`, error);
      // Assume not processed if we can't check (fail open)
      return false;
    }
  }

  /**
   * Mark an event as processed
   * @param eventId - The Twitter DM event ID
   * @param eventType - The type of event (e.g., "MessageCreate", "ParticipantsJoin")
   * @param consultantId - Optional consultant ID associated with the event
   * @param configId - Optional config ID associated with the event
   */
  async markEventProcessed(
    eventId: string,
    eventType: string,
    consultantId?: string,
    configId?: string
  ): Promise<void> {
    try {
      // Insert the processed event
      await pool.query(
        `INSERT INTO twitter_processed_events 
         (event_id, event_type, consultant_id, config_id, processed_at) 
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, eventType, consultantId || null, configId || null]
      );

      // Update cache
      this.processedEventCache.set(eventId, true);

      console.log(
        `✅ [TWITTER BACKFILL] Marked event ${eventId} as processed (type: ${eventType})`
      );
    } catch (error) {
      console.error(
        `❌ [TWITTER BACKFILL] Error marking event ${eventId} as processed:`,
        error
      );
      throw error;
    }
  }

  /**
   * Backfill DM events for a specific conversation with a user
   * Fetches recent DMs and processes only unprocessed events
   * 
   * @param configId - The Twitter config ID for OAuth credentials
   * @param participantId - The Twitter user ID to fetch DMs with
   * @param client - Configured TwitterClient instance
   * @returns Number of new events processed
   */
  async backfillConversation(
    configId: string,
    participantId: string,
    client: TwitterClient
  ): Promise<number> {
    console.log(
      `\n🔄 [TWITTER BACKFILL] Starting conversation backfill for participant ${participantId}`
    );

    let newEventsCount = 0;

    try {
      // Fetch recent DM events with the specific user
      const response = await client.getDMEventsWithUser(participantId, 100);

      if (!response.data || response.data.length === 0) {
        console.log(
          `ℹ️ [TWITTER BACKFILL] No DM events found for participant ${participantId}`
        );
        return 0;
      }

      console.log(
        `📨 [TWITTER BACKFILL] Fetched ${response.data.length} DM events for participant ${participantId}`
      );

      // Process each event
      for (const event of response.data) {
        const isProcessed = await this.isEventProcessed(event.id);

        if (isProcessed) {
          console.log(
            `⏭️ [TWITTER BACKFILL] Event ${event.id} already processed, skipping`
          );
          continue;
        }

        // Mark as processed
        await this.markEventProcessed(
          event.id,
          event.event_type || "MessageCreate",
          undefined,
          configId
        );

        newEventsCount++;
      }

      console.log(
        `✅ [TWITTER BACKFILL] Conversation backfill completed. New events: ${newEventsCount}`
      );

      return newEventsCount;
    } catch (error) {
      console.error(
        `❌ [TWITTER BACKFILL] Error backfilling conversation for participant ${participantId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Backfill all recent DM events from the authenticated user
   * Fetches recent DMs from all conversations and processes only unprocessed events
   * 
   * @param configId - The Twitter config ID for OAuth credentials
   * @param client - Configured TwitterClient instance
   * @returns Number of new events processed
   */
  async backfillAllRecent(
    configId: string,
    client: TwitterClient
  ): Promise<number> {
    console.log(`\n🔄 [TWITTER BACKFILL] Starting all recent DMs backfill`);

    let newEventsCount = 0;

    try {
      // Fetch all recent DM events
      const response = await client.getAllDMEvents(100);

      if (!response.data || response.data.length === 0) {
        console.log(`ℹ️ [TWITTER BACKFILL] No recent DM events found`);
        return 0;
      }

      console.log(
        `📨 [TWITTER BACKFILL] Fetched ${response.data.length} recent DM events`
      );

      // Track processed participants for logging
      const processedParticipants = new Set<string>();

      // Process each event
      for (const event of response.data) {
        const isProcessed = await this.isEventProcessed(event.id);

        if (isProcessed) {
          console.log(
            `⏭️ [TWITTER BACKFILL] Event ${event.id} already processed, skipping`
          );
          continue;
        }

        // Extract sender ID to track conversations
        if (event.sender_id) {
          processedParticipants.add(event.sender_id);
        }

        // Mark as processed
        await this.markEventProcessed(
          event.id,
          event.event_type || "MessageCreate",
          undefined,
          configId
        );

        newEventsCount++;
      }

      console.log(
        `✅ [TWITTER BACKFILL] All recent DMs backfill completed. New events: ${newEventsCount} from ${processedParticipants.size} participants`
      );

      return newEventsCount;
    } catch (error) {
      console.error(`❌ [TWITTER BACKFILL] Error backfilling all recent DMs:`, error);
      throw error;
    }
  }

  /**
   * Clear the processed event cache
   * Useful for testing or forcing a refresh
   */
  clearCache(): void {
    this.processedEventCache.clear();
    this.cacheInitialized = false;
    console.log(`🧹 [TWITTER BACKFILL] Cache cleared`);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    isInitialized: boolean;
  } {
    return {
      size: this.processedEventCache.size,
      isInitialized: this.cacheInitialized,
    };
  }
}

/**
 * Factory function to create a TwitterDMBackfill instance
 */
export function createTwitterDMBackfill(): TwitterDMBackfill {
  return new TwitterDMBackfill();
}
