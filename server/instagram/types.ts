/**
 * Instagram Integration Type Definitions
 * Based on Meta Graph API for Instagram Messaging
 */

// Meta Webhook Event Types
export interface MetaWebhookEvent {
  object: "instagram";
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // Instagram Business Account ID
  time: number;
  messaging?: MetaMessagingEvent[];
  changes?: MetaChange[];
}

// Messaging Events (DMs, Story Replies)
export interface MetaMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: MetaMessage;
  postback?: MetaPostback;
  read?: MetaReadEvent;
  reaction?: MetaReaction;
}

export interface MetaMessage {
  mid: string;
  text?: string;
  attachments?: MetaAttachment[];
  reply_to?: {
    mid?: string;
    story?: {
      id: string;
      url: string;
    };
  };
  is_echo?: boolean;
  quick_reply?: {
    payload: string;
  };
}

export interface MetaAttachment {
  type: "image" | "video" | "audio" | "file" | "story_mention" | "share" | "ig_reel" | "animated_media";
  payload: {
    url?: string;
    sticker_id?: number;
    reel_video_id?: string;
    product?: object;
  };
}

export interface MetaPostback {
  mid: string;
  title: string;
  payload: string;
}

export interface MetaReadEvent {
  mid: string;
  watermark: number;
}

export interface MetaReaction {
  mid: string;
  action: "react" | "unreact";
  reaction?: string;
  emoji?: string;
}

// Changes Events (Comments, Story Mentions)
export interface MetaChange {
  field: "comments" | "mentions" | "story_insights";
  value: MetaCommentValue | MetaStoryMentionValue;
}

export interface MetaCommentValue {
  id: string;
  text: string;
  from: {
    id: string;
    username: string;
  };
  media: {
    id: string;
    product_type?: string;
  };
  timestamp?: string;
}

export interface MetaStoryMentionValue {
  media_id: string;
  link: string;
  mentioned_id: string;
}

// Graph API Response Types
export interface MetaSendMessageResponse {
  recipient_id: string;
  message_id: string;
}

export interface MetaUserProfile {
  id: string;
  username: string;
  name?: string;
  profile_pic?: string;
}

export interface MetaGraphError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// Send Message Request Types
export interface MetaSendMessageRequest {
  recipient: { id: string };
  message: MetaOutboundMessage;
  messaging_type?: "RESPONSE" | "MESSAGE_TAG";
  tag?: "HUMAN_AGENT";
}

export interface MetaOutboundMessage {
  text?: string;
  attachment?: {
    type: "image" | "video" | "audio" | "file" | "template";
    payload: {
      url?: string;
      template_type?: "generic" | "button";
      elements?: object[];
      buttons?: MetaButton[];
    };
  };
  quick_replies?: MetaQuickReply[];
}

export interface MetaButton {
  type: "postback" | "web_url";
  title: string;
  payload?: string;
  url?: string;
}

export interface MetaQuickReply {
  content_type: "text" | "user_phone_number" | "user_email";
  title?: string;
  payload?: string;
}

// Internal Types
export interface InstagramMessageContext {
  conversationId: string;
  agentConfigId: string;
  consultantId: string;
  instagramUserId: string;
  instagramUsername?: string;
  sourceType: "dm" | "comment" | "story_reply" | "story_mention" | "ice_breaker";
  isWindowOpen: boolean;
  windowExpiresAt?: Date;
  messageHistory: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
}

export interface WindowStatus {
  isOpen: boolean;
  expiresAt: Date | null;
  canSendMessage: boolean;
  canUseHumanAgentTag: boolean;
  humanAgentExpiresAt: Date | null;
}

// Rate Limiting
export interface RateLimitStatus {
  remaining: number;
  resetAt: Date;
  isLimited: boolean;
}

// Config Types
export interface InstagramAgentConfig {
  id: string;
  consultantId: string;
  instagramPageId: string;
  pageAccessToken: string;
  isActive: boolean;
  isDryRun: boolean;
  autoResponseEnabled: boolean;
  commentToDmEnabled: boolean;
  storyReplyEnabled: boolean;
  iceBreakersEnabled: boolean;
}
