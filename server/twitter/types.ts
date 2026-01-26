/**
 * Twitter/X API Types
 * Based on X API v2 and Account Activity API v1.1
 */

// Webhook Event Types from Account Activity API
export interface TwitterWebhookEvent {
  for_user_id: string;
  user_has_blocked?: boolean;
  direct_message_events?: TwitterDMEvent[];
  direct_message_indicate_typing_events?: TwitterTypingEvent[];
  direct_message_mark_read_events?: TwitterReadEvent[];
  tweet_create_events?: TwitterTweetEvent[];
  favorite_events?: TwitterFavoriteEvent[];
  follow_events?: TwitterFollowEvent[];
  users?: Record<string, TwitterUser>;
}

// DM Event from webhook
export interface TwitterDMEvent {
  type: "message_create";
  id: string;
  created_timestamp: string;
  message_create: {
    target: {
      recipient_id: string;
    };
    sender_id: string;
    source_app_id?: string;
    message_data: {
      text: string;
      entities?: {
        hashtags?: Array<{ text: string; indices: [number, number] }>;
        urls?: Array<{ url: string; expanded_url: string; display_url: string; indices: [number, number] }>;
        user_mentions?: Array<{ id: number; id_str: string; name: string; screen_name: string; indices: [number, number] }>;
      };
      attachment?: {
        type: "media";
        media: {
          id: number;
          id_str: string;
          media_url: string;
          media_url_https: string;
          type: "photo" | "video" | "animated_gif";
        };
      };
      quick_reply_response?: {
        type: string;
        metadata: string;
      };
    };
  };
}

// Typing indicator event
export interface TwitterTypingEvent {
  created_timestamp: string;
  sender_id: string;
  target: {
    recipient_id: string;
  };
}

// Read receipt event
export interface TwitterReadEvent {
  created_timestamp: string;
  sender_id: string;
  target: {
    recipient_id: string;
  };
  last_read_event_id: string;
}

// Tweet event
export interface TwitterTweetEvent {
  id: number;
  id_str: string;
  text: string;
  truncated: boolean;
  user: TwitterUser;
  created_at: string;
  in_reply_to_status_id?: number;
  in_reply_to_status_id_str?: string;
  in_reply_to_user_id?: number;
  in_reply_to_user_id_str?: string;
  in_reply_to_screen_name?: string;
}

// Favorite event
export interface TwitterFavoriteEvent {
  id: string;
  created_at: string;
  timestamp_ms: number;
  favorited_status: TwitterTweetEvent;
  user: TwitterUser;
}

// Follow event
export interface TwitterFollowEvent {
  type: "follow" | "unfollow";
  created_timestamp: string;
  target: TwitterUser;
  source: TwitterUser;
}

// User object
export interface TwitterUser {
  id: number;
  id_str: string;
  name: string;
  screen_name: string;
  description?: string;
  profile_image_url?: string;
  profile_image_url_https?: string;
  followers_count?: number;
  friends_count?: number;
  verified?: boolean;
  protected?: boolean;
}

// API v2 Response Types
export interface TwitterAPIv2Response<T> {
  data?: T;
  includes?: {
    users?: TwitterAPIv2User[];
    tweets?: TwitterAPIv2Tweet[];
  };
  meta?: {
    next_token?: string;
    result_count?: number;
  };
  errors?: TwitterAPIv2Error[];
}

export interface TwitterAPIv2User {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  verified?: boolean;
  protected?: boolean;
}

export interface TwitterAPIv2Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at?: string;
}

export interface TwitterAPIv2Error {
  title: string;
  detail: string;
  type: string;
  status?: number;
}

// DM Event v2
export interface TwitterDMEventV2 {
  id: string;
  text?: string;
  event_type: "MessageCreate" | "ParticipantsJoin" | "ParticipantsLeave";
  sender_id?: string;
  dm_conversation_id: string;
  created_at?: string;
  attachments?: {
    media_keys?: string[];
  };
}

// Send DM Request
export interface SendDMRequest {
  text: string;
  attachments?: {
    media_id: string;
  }[];
}

// Send DM Response
export interface SendDMResponse {
  dm_conversation_id: string;
  dm_event_id: string;
}

// OAuth Tokens
export interface TwitterOAuthTokens {
  accessToken: string;
  accessTokenSecret: string;
  userId: string;
  screenName: string;
}

export interface TwitterOAuth2Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

// Webhook Management
export interface TwitterWebhookInfo {
  id: string;
  url: string;
  valid: boolean;
  created_timestamp: string;
}

export interface TwitterSubscriptionInfo {
  user_id: string;
}

// CRC Challenge
export interface CRCChallenge {
  crc_token: string;
}

export interface CRCResponse {
  response_token: string;
}
