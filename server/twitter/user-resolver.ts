/**
 * Twitter User Resolver with Caching
 * Caches username → user_id resolution to avoid repeated API calls
 * Cache TTL: 30 days
 */

import { pool } from '../db';
import { TwitterClient } from './twitter-client';
import { TwitterAPIv2User } from './types';

export interface CachedTwitterUser {
  twitter_user_id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  verified: boolean | null;
  protected: boolean | null;
  followers_count: number | null;
  following_count: number | null;
  cached_at: Date;
  expires_at: Date;
}

export class TwitterUserResolver {
  /**
   * Resolve username to user_id
   * Checks cache first (if not expired), then calls API on miss
   */
  async resolveUsername(
    username: string,
    client: TwitterClient
  ): Promise<string | null> {
    if (!username) return null;

    // Normalize username (remove @ if present)
    const normalizedUsername = username.startsWith('@')
      ? username.slice(1)
      : username;

    try {
      // Check cache first
      const cached = await this.getFromCache(normalizedUsername);
      if (cached) {
        console.log(
          `✅ [TWITTER CACHE HIT] ${normalizedUsername} → ${cached.twitter_user_id}`
        );
        // Update cached_at on hit
        await this.updateCacheTimestamp(normalizedUsername);
        return cached.twitter_user_id;
      }

      // Cache miss - fetch from API
      console.log(
        `🔄 [TWITTER CACHE MISS] ${normalizedUsername} - fetching from API`
      );
      const user = await client.getUserByUsername(normalizedUsername);
      if (!user) {
        console.warn(`❌ [TWITTER API] User @${normalizedUsername} not found`);
        return null;
      }

      // Cache the result
      await this.saveToCache(user);
      console.log(
        `💾 [TWITTER CACHE SAVE] ${normalizedUsername} → ${user.id}`
      );

      return user.id;
    } catch (error) {
      console.error(
        `❌ [TWITTER RESOLVER] Error resolving username @${normalizedUsername}:`,
        error
      );
      // Return null on error instead of throwing
      return null;
    }
  }

  /**
   * Resolve user_id to full user data
   * Checks cache first (if not expired), then calls API on miss
   */
  async resolveUserId(
    userId: string,
    client: TwitterClient
  ): Promise<TwitterAPIv2User | null> {
    if (!userId) return null;

    try {
      // Check cache by user_id
      const cached = await this.getFromCacheById(userId);
      if (cached) {
        console.log(`✅ [TWITTER CACHE HIT] User ID ${userId}`);
        // Update cached_at on hit
        await this.updateCacheTimestampById(userId);
        return {
          id: cached.twitter_user_id,
          username: cached.username,
          name: cached.display_name || cached.username,
          profile_image_url: cached.profile_image_url,
          verified: cached.verified,
          protected: cached.protected,
        };
      }

      // Cache miss - fetch from API
      console.log(`🔄 [TWITTER CACHE MISS] User ID ${userId} - fetching from API`);
      const user = await client.getUserById(userId);
      if (!user) {
        console.warn(`❌ [TWITTER API] User ID ${userId} not found`);
        return null;
      }

      // Cache the result
      await this.saveToCache(user);
      console.log(`💾 [TWITTER CACHE SAVE] User ID ${userId}`);

      return user;
    } catch (error) {
      console.error(
        `❌ [TWITTER RESOLVER] Error resolving user ID ${userId}:`,
        error
      );
      // Return null on error instead of throwing
      return null;
    }
  }

  /**
   * Invalidate cache entry for a username
   */
  async invalidateCache(username: string): Promise<void> {
    if (!username) return;

    const normalizedUsername = username.startsWith('@')
      ? username.slice(1)
      : username;

    try {
      await pool.query(
        'DELETE FROM twitter_users_cache WHERE username = $1',
        [normalizedUsername]
      );
      console.log(
        `🗑️ [TWITTER CACHE] Invalidated cache for @${normalizedUsername}`
      );
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error invalidating cache for @${normalizedUsername}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get cached user by username (internal method)
   * Returns null if not found or expired
   */
  private async getFromCache(username: string): Promise<CachedTwitterUser | null> {
    try {
      const result = await pool.query<CachedTwitterUser>(
        `SELECT 
          twitter_user_id, username, display_name, profile_image_url,
          verified, protected, followers_count, following_count,
          cached_at, expires_at
        FROM twitter_users_cache
        WHERE username = $1 AND expires_at > NOW()
        LIMIT 1`,
        [username]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error querying cache for @${username}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get cached user by twitter_user_id (internal method)
   * Returns null if not found or expired
   */
  private async getFromCacheById(
    userId: string
  ): Promise<CachedTwitterUser | null> {
    try {
      const result = await pool.query<CachedTwitterUser>(
        `SELECT 
          twitter_user_id, username, display_name, profile_image_url,
          verified, protected, followers_count, following_count,
          cached_at, expires_at
        FROM twitter_users_cache
        WHERE twitter_user_id = $1 AND expires_at > NOW()
        LIMIT 1`,
        [userId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error querying cache for user ID ${userId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Save user to cache or update existing entry
   */
  private async saveToCache(user: TwitterAPIv2User): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await pool.query(
        `INSERT INTO twitter_users_cache (
          twitter_user_id, username, display_name, profile_image_url,
          verified, protected, followers_count, following_count,
          cached_at, expires_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (twitter_user_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          profile_image_url = EXCLUDED.profile_image_url,
          verified = EXCLUDED.verified,
          protected = EXCLUDED.protected,
          followers_count = EXCLUDED.followers_count,
          following_count = EXCLUDED.following_count,
          cached_at = EXCLUDED.cached_at,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at`,
        [
          user.id,
          user.username,
          user.name,
          user.profile_image_url || null,
          user.verified || false,
          user.protected || false,
          null, // followers_count - could be enhanced if API provides it
          null, // following_count - could be enhanced if API provides it
          now,
          expiresAt,
          now,
          now,
        ]
      );
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error saving to cache for user ${user.id}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Update cached_at timestamp on cache hit (by username)
   */
  private async updateCacheTimestamp(username: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE twitter_users_cache SET cached_at = NOW() WHERE username = $1',
        [username]
      );
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error updating cache timestamp for @${username}:`,
        error
      );
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Update cached_at timestamp on cache hit (by user_id)
   */
  private async updateCacheTimestampById(userId: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE twitter_users_cache SET cached_at = NOW() WHERE twitter_user_id = $1',
        [userId]
      );
    } catch (error) {
      console.error(
        `❌ [TWITTER CACHE] Error updating cache timestamp for user ID ${userId}:`,
        error
      );
      // Don't throw - this is a non-critical operation
    }
  }
}

/**
 * Create a Twitter user resolver instance
 */
export function createTwitterUserResolver(): TwitterUserResolver {
  return new TwitterUserResolver();
}
