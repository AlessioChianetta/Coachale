/**
 * Twitter/X Media Upload Handler
 * Handles media uploads with 24-hour TTL tracking
 */

import crypto from "crypto";
import OAuth from "oauth-1.0a";
import { TWITTER_API_V1_BASE } from "./index";
import { pool } from "../db";

export interface TwitterMediaUploaderConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface UploadedMedia {
  mediaId: string;
  expiresAt: Date;
}

export class TwitterMediaUploader {
  private oauth: OAuth;
  private accessToken: string;
  private accessTokenSecret: string;
  private apiKey: string;
  private apiSecret: string;
  private readonly TTL_HOURS = 24;
  private readonly UPLOAD_ENDPOINT = `${TWITTER_API_V1_BASE}/media/upload.json`;

  constructor(config: TwitterMediaUploaderConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;

    this.oauth = new OAuth({
      consumer: {
        key: config.apiKey,
        secret: config.apiSecret,
      },
      signature_method: "HMAC-SHA1",
      hash_function(baseString, key) {
        return crypto
          .createHmac("sha1", key)
          .update(baseString)
          .digest("base64");
      },
    });
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(
    consultantId: string,
    configId: string | null,
    fileBuffer: Buffer,
    mediaType: "image" | "video" | "gif",
    originalUrl?: string
  ): Promise<UploadedMedia> {
    try {
      console.log(
        `📤 [TWITTER MEDIA] Uploading ${mediaType} for consultant ${consultantId}`
      );

      // Step 1: Upload to Twitter's API
      const twitterResponse = await this.uploadToTwitter(fileBuffer);

      if (!twitterResponse.media_id_string) {
        throw new Error("No media_id returned from Twitter API");
      }

      // Step 2: Store in database with TTL
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

      const fileSize = fileBuffer.length;

      const query = `
        INSERT INTO twitter_media_uploads (
          consultant_id,
          config_id,
          media_id,
          file_size,
          media_type,
          original_url,
          expires_at,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, NOW()
        )
        RETURNING media_id, expires_at;
      `;

      const values = [
        consultantId,
        configId,
        twitterResponse.media_id_string,
        fileSize,
        mediaType,
        originalUrl || null,
        expiresAt,
      ];

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error("Failed to store media in database");
      }

      const row = result.rows[0];
      console.log(
        `✅ [TWITTER MEDIA] Upload successful - Media ID: ${twitterResponse.media_id_string}`
      );

      return {
        mediaId: row.media_id,
        expiresAt: new Date(row.expires_at),
      };
    } catch (error) {
      console.error(`❌ [TWITTER MEDIA] Upload failed:`, error);
      throw error;
    }
  }

  /**
   * Check if media is still valid (not expired)
   */
  async getValidMedia(mediaId: string): Promise<UploadedMedia | null> {
    try {
      const query = `
        SELECT media_id, expires_at
        FROM twitter_media_uploads
        WHERE media_id = $1
        AND expires_at > NOW()
        LIMIT 1;
      `;

      const result = await pool.query(query, [mediaId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        mediaId: row.media_id,
        expiresAt: new Date(row.expires_at),
      };
    } catch (error) {
      console.error(
        `❌ [TWITTER MEDIA] Failed to check media validity:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clean up expired media entries from database
   * Note: This only removes DB records, not the actual media from Twitter
   * Twitter automatically expires media after 24 hours
   */
  async cleanupExpiredMedia(): Promise<number> {
    try {
      console.log(`🧹 [TWITTER MEDIA] Starting cleanup of expired media...`);

      const query = `
        DELETE FROM twitter_media_uploads
        WHERE expires_at <= NOW();
      `;

      const result = await pool.query(query);
      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        console.log(
          `✅ [TWITTER MEDIA] Cleaned up ${deletedCount} expired media entries`
        );
      } else {
        console.log(`ℹ️  [TWITTER MEDIA] No expired media to clean up`);
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ [TWITTER MEDIA] Cleanup failed:`, error);
      throw error;
    }
  }

  /**
   * Upload media to Twitter API v1.1
   * Uses OAuth 1.0a authentication with base64-encoded media_data
   * This approach is Node.js compatible without needing FormData/Blob polyfills
   */
  private async uploadToTwitter(
    fileBuffer: Buffer
  ): Promise<{
    media_id_string: string;
    size?: number;
    expires_after_secs?: number;
  }> {
    try {
      // Convert buffer to base64 for media_data parameter
      const mediaData = fileBuffer.toString("base64");

      // For OAuth 1.0a with x-www-form-urlencoded, body params must be included in signature
      const bodyData = { media_data: mediaData };

      const requestData = {
        url: this.UPLOAD_ENDPOINT,
        method: "POST",
        data: bodyData, // Include body params in OAuth signature calculation
      };

      const token = {
        key: this.accessToken,
        secret: this.accessTokenSecret,
      };

      // Generate OAuth headers (includes body params in signature)
      const authHeader = this.oauth.toHeader(
        this.oauth.authorize(requestData, token)
      ) as Record<string, string>;

      // Build URL-encoded body
      const bodyParams = new URLSearchParams();
      bodyParams.append("media_data", mediaData);

      const fetchOptions: RequestInit = {
        method: "POST",
        headers: {
          ...authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      };

      console.log(`🐦 [TWITTER API] POST ${this.UPLOAD_ENDPOINT} (base64 upload)`);

      const response = await fetch(this.UPLOAD_ENDPOINT, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ [TWITTER MEDIA API] Error:`, errorData);
        throw new Error(
          `Twitter media upload failed: ${response.status} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      console.log(`✅ [TWITTER MEDIA API] Upload response:`, {
        media_id_string: data.media_id_string,
        size: data.size,
        expires_after_secs: data.expires_after_secs,
      });

      return data;
    } catch (error) {
      console.error(`❌ [TWITTER MEDIA] Upload to Twitter failed:`, error);
      throw error;
    }
  }
}

/**
 * Create a Twitter media uploader instance
 */
export function createTwitterMediaUploader(
  config: TwitterMediaUploaderConfig
): TwitterMediaUploader {
  return new TwitterMediaUploader(config);
}
