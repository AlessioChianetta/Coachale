import { db } from '../db';
import { voiceRateLimits } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { voiceConfig } from './config';

interface RateLimitConfig {
  maxCallsPerMinute: number;
  maxCallsPerHour: number;
  maxCallsPerDay: number;
  blockAnonymous: boolean;
  blockedPrefixes: string[];
}

interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  waitSeconds?: number;
  remainingCalls?: {
    minute: number;
    hour: number;
    day: number;
  };
}

interface CallerStats {
  callsLastMinute: number;
  callsLastHour: number;
  callsLastDay: number;
  lastCallTime: Date | null;
}

export class VoiceRateLimiter {
  private config: RateLimitConfig;
  private blockedCallers: Map<string, { until: Date; reason: string }> = new Map();

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxCallsPerMinute: config?.maxCallsPerMinute || voiceConfig.rateLimits.maxCallsPerMinute,
      maxCallsPerHour: config?.maxCallsPerHour || voiceConfig.rateLimits.maxCallsPerHour,
      maxCallsPerDay: config?.maxCallsPerDay || voiceConfig.rateLimits.maxCallsPerDay,
      blockAnonymous: config?.blockAnonymous ?? voiceConfig.rateLimits.blockAnonymous,
      blockedPrefixes: config?.blockedPrefixes || voiceConfig.rateLimits.blockedPrefixes,
    };
  }

  async checkRateLimit(callerId: string, voiceNumberId: string): Promise<RateLimitResult> {
    if (!callerId || callerId === 'anonymous' || callerId === 'unknown') {
      if (this.config.blockAnonymous) {
        return {
          allowed: false,
          reason: 'ANONYMOUS_BLOCKED',
        };
      }
    }

    const blockedPrefix = this.config.blockedPrefixes.find(prefix => callerId.startsWith(prefix));
    if (blockedPrefix) {
      return {
        allowed: false,
        reason: `BLOCKED_PREFIX:${blockedPrefix}`,
      };
    }

    const manualBlock = this.blockedCallers.get(callerId);
    if (manualBlock && manualBlock.until > new Date()) {
      return {
        allowed: false,
        reason: `MANUAL_BLOCK:${manualBlock.reason}`,
        waitSeconds: Math.ceil((manualBlock.until.getTime() - Date.now()) / 1000),
      };
    }

    const stats = await this.getCallerStats(callerId);

    if (stats.callsLastMinute >= this.config.maxCallsPerMinute) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_MINUTE',
        waitSeconds: 60,
        remainingCalls: {
          minute: 0,
          hour: this.config.maxCallsPerHour - stats.callsLastHour,
          day: this.config.maxCallsPerDay - stats.callsLastDay,
        },
      };
    }

    if (stats.callsLastHour >= this.config.maxCallsPerHour) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_HOUR',
        waitSeconds: 3600,
        remainingCalls: {
          minute: 0,
          hour: 0,
          day: this.config.maxCallsPerDay - stats.callsLastDay,
        },
      };
    }

    if (stats.callsLastDay >= this.config.maxCallsPerDay) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_DAY',
        waitSeconds: 86400,
        remainingCalls: {
          minute: 0,
          hour: 0,
          day: 0,
        },
      };
    }

    await this.recordCall(callerId);

    return {
      allowed: true,
      remainingCalls: {
        minute: this.config.maxCallsPerMinute - stats.callsLastMinute - 1,
        hour: this.config.maxCallsPerHour - stats.callsLastHour - 1,
        day: this.config.maxCallsPerDay - stats.callsLastDay - 1,
      },
    };
  }

  private async getCallerStats(callerId: string): Promise<CallerStats> {
    try {
      const existing = await db
        .select()
        .from(voiceRateLimits)
        .where(eq(voiceRateLimits.callerId, callerId))
        .limit(1);

      if (existing.length === 0) {
        return {
          callsLastMinute: 0,
          callsLastHour: 0,
          callsLastDay: 0,
          lastCallTime: null,
        };
      }

      const record = existing[0];
      const now = new Date();
      
      const firstCallToday = record.firstCallToday;
      const isNewDay = !firstCallToday || 
        firstCallToday.toDateString() !== now.toDateString();

      return {
        callsLastMinute: isNewDay ? 0 : (record.callsLastMinute || 0),
        callsLastHour: isNewDay ? 0 : (record.callsLastHour || 0),
        callsLastDay: isNewDay ? 0 : (record.callsToday || 0),
        lastCallTime: record.lastCallAt,
      };
    } catch (error) {
      console.error('[RateLimiter] Error getting caller stats:', error);
      return {
        callsLastMinute: 0,
        callsLastHour: 0,
        callsLastDay: 0,
        lastCallTime: null,
      };
    }
  }

  private async recordCall(callerId: string): Promise<void> {
    const now = new Date();

    try {
      const existing = await db
        .select()
        .from(voiceRateLimits)
        .where(eq(voiceRateLimits.callerId, callerId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(voiceRateLimits).values({
          callerId,
          callsLastMinute: 1,
          callsLastHour: 1,
          callsToday: 1,
          totalMinutesToday: "0",
          lastCallAt: now,
          firstCallToday: now,
        });
      } else {
        const record = existing[0];
        const firstCallToday = record.firstCallToday;
        const isNewDay = !firstCallToday || 
          firstCallToday.toDateString() !== now.toDateString();

        if (isNewDay) {
          await db
            .update(voiceRateLimits)
            .set({
              callsLastMinute: 1,
              callsLastHour: 1,
              callsToday: 1,
              totalMinutesToday: "0",
              lastCallAt: now,
              firstCallToday: now,
              updatedAt: now,
            })
            .where(eq(voiceRateLimits.id, record.id));
        } else {
          await db
            .update(voiceRateLimits)
            .set({
              callsLastMinute: (record.callsLastMinute || 0) + 1,
              callsLastHour: (record.callsLastHour || 0) + 1,
              callsToday: (record.callsToday || 0) + 1,
              lastCallAt: now,
              updatedAt: now,
            })
            .where(eq(voiceRateLimits.id, record.id));
        }
      }
    } catch (error) {
      console.error('[RateLimiter] Error recording call:', error);
    }
  }

  async blockCaller(callerId: string, durationMinutes: number, reason: string): Promise<void> {
    const until = new Date(Date.now() + durationMinutes * 60 * 1000);
    this.blockedCallers.set(callerId, { until, reason });

    try {
      const existing = await db
        .select()
        .from(voiceRateLimits)
        .where(eq(voiceRateLimits.callerId, callerId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(voiceRateLimits)
          .set({ 
            isBlocked: true,
            blockedReason: reason,
            blockedUntil: until,
            updatedAt: new Date(),
          })
          .where(eq(voiceRateLimits.callerId, callerId));
      } else {
        await db.insert(voiceRateLimits).values({
          callerId,
          isBlocked: true,
          blockedReason: reason,
          blockedUntil: until,
        });
      }

      console.log(`[RateLimiter] Blocked caller ${callerId} until ${until.toISOString()}: ${reason}`);
    } catch (error) {
      console.error('[RateLimiter] Error blocking caller:', error);
    }
  }

  async unblockCaller(callerId: string): Promise<void> {
    this.blockedCallers.delete(callerId);

    try {
      await db
        .update(voiceRateLimits)
        .set({ 
          isBlocked: false,
          blockedReason: null,
          blockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(voiceRateLimits.callerId, callerId));

      console.log(`[RateLimiter] Unblocked caller ${callerId}`);
    } catch (error) {
      console.error('[RateLimiter] Error unblocking caller:', error);
    }
  }

  isBlocked(callerId: string): boolean {
    const block = this.blockedCallers.get(callerId);
    return block !== undefined && block.until > new Date();
  }

  getBlockedCallers(): Array<{ callerId: string; until: Date; reason: string }> {
    const result: Array<{ callerId: string; until: Date; reason: string }> = [];
    const now = new Date();

    this.blockedCallers.forEach((block, callerId) => {
      if (block.until > now) {
        result.push({ callerId, ...block });
      }
    });

    return result;
  }

  async cleanupExpiredRecords(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      await db
        .delete(voiceRateLimits)
        .where(
          and(
            sql`${voiceRateLimits.lastCallAt} < ${cutoff}`,
            eq(voiceRateLimits.isBlocked, false)
          )
        );

      return 0;
    } catch (error) {
      console.error('[RateLimiter] Cleanup error:', error);
      return 0;
    }
  }

  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[RateLimiter] Config updated:', this.config);
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

export const rateLimiter = new VoiceRateLimiter();
