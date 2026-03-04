/**
 * WhatsApp Agent Share Public Routes
 * Unauthenticated public endpoints for accessing shared agents
 */

import express, { Request, Response, NextFunction } from 'express';
import * as shareService from '../../whatsapp/share-service';
import * as agentService from '../../whatsapp/agent-consultant-chat-service';
import type { PendingModificationContext, BookingContext } from '../../whatsapp/agent-consultant-chat-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { generateSpeech } from '../../ai/tts-service';
import { shouldRespondWithAudio } from '../../whatsapp/audio-response-utils';
import { getAIProvider, getModelWithThinking, getSuperAdminGeminiKeys, trackedGenerateContent } from '../../ai/provider-factory';
import { getAudioDurationInSeconds } from 'get-audio-duration';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractBookingDataFromConversation,
  validateBookingData,
  createBookingRecord,
  createGoogleCalendarBooking,
  createStandaloneCalendarBooking,
  resolveRoundRobinAgent,
  sendBookingConfirmationEmail,
  sendBookingNotification,
  formatAppointmentDate,
  markExtractionStateCompleted,
  BookingExtractionResult,
  ConversationMessage,
} from '../../booking/booking-service';
import { shouldAnalyzeForBooking, isActionAlreadyCompleted, LastCompletedAction, ActionDetails } from '../../booking/booking-intent-detector';

const router = express.Router();

/**
 * Middleware to validate domain access for iframe embeds
 */
function validateDomainAccess(
  req: Request & { share?: schema.WhatsappAgentShare },
  res: Response,
  next: NextFunction
) {
  const share = req.share;
  if (!share) {
    return res.status(500).json({ error: 'Share non trovato in request context' });
  }
  
  // Skip domain check if no whitelist configured (allow all)
  if (!share.allowedDomains || share.allowedDomains.length === 0) {
    return next();
  }
  
  // Check Origin or Referer header
  const origin = req.get('origin');
  const referer = req.get('referer');
  const sourceHeader = origin || referer;
  
  if (!sourceHeader) {
    // No origin/referer - likely direct access or tool (allow for now)
    return next();
  }
  
  // Extract and validate domain
  const domain = shareService.extractDomain(sourceHeader);
  if (!domain) {
    return res.status(403).json({ error: 'Impossibile validare il dominio di origine' });
  }
  
  // Check domain whitelist
  const isAllowed = shareService.validateDomain(domain, share.allowedDomains);
  if (!isAllowed) {
    return res.status(403).json({ 
      error: 'Accesso negato: dominio non autorizzato',
      domain: domain,
    });
  }
  
  next();
}

/**
 * Middleware to validate visitor session for password-protected shares
 * Also handles manager JWT tokens and Bronze tokens for any share type
 */
async function validateVisitorSession(
  req: Request & { share?: schema.WhatsappAgentShare; managerId?: string; bronzeUserId?: string; tokenType?: 'bronze' | 'silver' | 'gold' | 'manager' },
  res: Response,
  next: NextFunction
) {
  try {
    const share = req.share;
    console.log(`\n🔍 [VALIDATE-SESSION] Share: ${share?.slug}, accessType: ${share?.accessType}`);
    
    if (!share) {
      console.log(`❌ [VALIDATE-SESSION] Share not found in request context`);
      return res.status(500).json({ error: 'Share non trovato in request context' });
    }
    
    // ALWAYS check for JWT token first (for any share type)
    // This handles both manager tokens and Bronze tokens
    const authHeader = req.headers.authorization;
    console.log(`🔑 [VALIDATE-SESSION] Auth header present: ${!!authHeader}, starts with Bearer: ${authHeader?.startsWith('Bearer ')}`);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Try JWT_SECRET first (used by unified login), then SESSION_SECRET (used by manager login)
      // Note: routes.ts uses "your-secret-key" as fallback when JWT_SECRET is not set
      const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";
      const sessionSecret = process.env.SESSION_SECRET;
      console.log(`🔐 [VALIDATE-SESSION] JWT_SECRET available: ${!!jwtSecret}, SESSION_SECRET available: ${!!sessionSecret}`);
      
      // Try to decode with JWT_SECRET first
      let decoded: any = null;
      if (jwtSecret) {
        try {
          decoded = jwt.verify(token, jwtSecret) as any;
          console.log(`📜 [VALIDATE-SESSION] Token decoded with JWT_SECRET:`, { type: decoded.type, role: decoded.role, bronzeUserId: decoded.bronzeUserId, managerId: decoded.managerId });
        } catch (e) {
          console.log(`⚠️ [VALIDATE-SESSION] JWT_SECRET verification failed: ${(e as Error).message}`);
        }
      }
      
      // If JWT_SECRET failed, try SESSION_SECRET
      if (!decoded && sessionSecret) {
        try {
          decoded = jwt.verify(token, sessionSecret) as any;
          console.log(`📜 [VALIDATE-SESSION] Token decoded with SESSION_SECRET:`, { type: decoded.type, role: decoded.role, bronzeUserId: decoded.bronzeUserId, managerId: decoded.managerId });
        } catch (e) {
          console.log(`⚠️ [VALIDATE-SESSION] SESSION_SECRET verification failed: ${(e as Error).message}`);
        }
      }
      
      if (decoded) {
        // Check for Bronze token (type: "bronze")
        if (decoded.type === 'bronze' && decoded.bronzeUserId) {
          console.log(`🔶 [VALIDATE-SESSION] Bronze token detected, verifying user...`);
          // Verify Bronze user exists and is active
          const [bronzeUser] = await db.select()
            .from(schema.bronzeUsers)
            .where(eq(schema.bronzeUsers.id, decoded.bronzeUserId))
            .limit(1);
          
          console.log(`🔶 [VALIDATE-SESSION] Bronze user found: ${!!bronzeUser}, isActive: ${bronzeUser?.isActive}`);
          
          if (bronzeUser && bronzeUser.isActive) {
            // Check if this agent is disabled for this user (with userType to avoid collisions)
            if (share.agentConfigId) {
              const [disabledAccess] = await db.select()
                .from(schema.bronzeUserAgentAccess)
                .where(
                  and(
                    eq(schema.bronzeUserAgentAccess.bronzeUserId, decoded.bronzeUserId),
                    eq(schema.bronzeUserAgentAccess.agentConfigId, share.agentConfigId),
                    eq(schema.bronzeUserAgentAccess.userType, "bronze"),
                    eq(schema.bronzeUserAgentAccess.isEnabled, false)
                  )
                )
                .limit(1);
              
              if (disabledAccess) {
                console.log(`🚫 [VALIDATE-SESSION] Agent disabled for this Bronze user, agentConfigId: ${share.agentConfigId}`);
                return res.status(403).json({ 
                  error: 'Accesso negato: questo agente non è disponibile per il tuo account',
                  code: 'AGENT_DISABLED'
                });
              }
            }
            
            req.bronzeUserId = decoded.bronzeUserId;
            req.managerId = decoded.bronzeUserId; // Use bronzeUserId as managerId for compatibility
            req.tokenType = 'bronze';
            console.log(`✅ [BRONZE AUTH] Valid bronze token for share ${share.slug}, bronzeUserId: ${decoded.bronzeUserId}`);
            return next();
          } else {
            console.log(`❌ [VALIDATE-SESSION] Bronze user not found or inactive`);
          }
        }
        
        // Check for Silver token (type: "silver")
        if (decoded.type === 'silver' && decoded.subscriptionId) {
          console.log(`🥈 [VALIDATE-SESSION] Silver token detected, verifying subscription...`);
          // Verify Silver subscription exists and is active
          const [silverSubscription] = await db.select()
            .from(schema.clientLevelSubscriptions)
            .where(
              and(
                eq(schema.clientLevelSubscriptions.id, decoded.subscriptionId),
                eq(schema.clientLevelSubscriptions.status, 'active')
              )
            )
            .limit(1);
          
          console.log(`🥈 [VALIDATE-SESSION] Silver subscription found: ${!!silverSubscription}, status: ${silverSubscription?.status}`);
          
          if (silverSubscription) {
            // Check if this agent is disabled for this Silver user (with userType to avoid collisions)
            if (share.agentConfigId) {
              const [disabledAccess] = await db.select()
                .from(schema.bronzeUserAgentAccess)
                .where(
                  and(
                    eq(schema.bronzeUserAgentAccess.bronzeUserId, decoded.subscriptionId),
                    eq(schema.bronzeUserAgentAccess.agentConfigId, share.agentConfigId),
                    eq(schema.bronzeUserAgentAccess.userType, "silver"),
                    eq(schema.bronzeUserAgentAccess.isEnabled, false)
                  )
                )
                .limit(1);
              
              if (disabledAccess) {
                console.log(`🚫 [VALIDATE-SESSION] Agent disabled for this Silver user, agentConfigId: ${share.agentConfigId}`);
                return res.status(403).json({ 
                  error: 'Accesso negato: questo agente non è disponibile per il tuo account',
                  code: 'AGENT_DISABLED'
                });
              }
            }
            
            req.managerId = decoded.subscriptionId; // Use subscriptionId as managerId for compatibility
            req.tokenType = 'silver';
            console.log(`✅ [SILVER AUTH] Valid silver token for share ${share.slug}, subscriptionId: ${decoded.subscriptionId}`);
            return next();
          } else {
            console.log(`❌ [VALIDATE-SESSION] Silver subscription not found or inactive`);
          }
        }
        
        // Check for manager role and matching shareId
        if (decoded.role === 'manager' && decoded.shareId === share.id && decoded.managerId) {
          // Valid manager token - attach managerId to request and proceed
          req.managerId = decoded.managerId;
          req.tokenType = 'manager';
          console.log(`✅ [MANAGER AUTH] Valid manager token for share ${share.slug}, managerId: ${decoded.managerId}`);
          return next();
        }
        
        // Check for Consultant Gold Preview token (isConsultantPreview: true)
        // This allows consultants to test their own agents with Gold-level access
        if (decoded.type === 'gold' && decoded.isConsultantPreview && decoded.userId) {
          console.log(`🎯 [VALIDATE-SESSION] Consultant Gold preview token detected, verifying consultant...`, { userId: decoded.userId, subscriptionId: decoded.subscriptionId });
          // Verify the consultant exists and is active
          const [consultant] = await db.select()
            .from(schema.users)
            .where(
              and(
                eq(schema.users.id, decoded.userId),
                eq(schema.users.role, 'consultant'),
                eq(schema.users.isActive, true)
              )
            )
            .limit(1);
          
          if (consultant) {
            // Consultant preview bypasses all access checks - they can access all their own agents
            req.managerId = decoded.subscriptionId || `consultant-preview-${decoded.userId}`;
            req.tokenType = 'gold';
            console.log(`✅ [CONSULTANT PREVIEW] Valid consultant preview token for share ${share.slug}, consultantId: ${decoded.userId}`);
            return next();
          } else {
            console.log(`❌ [VALIDATE-SESSION] Consultant not found or inactive`);
          }
        }
        
        // Check for new Gold token format (with type: "gold" and subscriptionId)
        if (decoded.type === 'gold' && decoded.subscriptionId && decoded.userId) {
          console.log(`🏆 [VALIDATE-SESSION] Gold token with subscriptionId, verifying user...`, { userId: decoded.userId, subscriptionId: decoded.subscriptionId });
          // Verify the client exists and is active
          const [goldClient] = await db.select()
            .from(schema.users)
            .where(
              and(
                eq(schema.users.id, decoded.userId),
                eq(schema.users.role, 'client'),
                eq(schema.users.isActive, true)
              )
            )
            .limit(1);
          
          if (goldClient) {
            // Check if this agent is disabled for this Gold user
            if (share.agentConfigId) {
              const [disabledAccess] = await db.select()
                .from(schema.bronzeUserAgentAccess)
                .where(
                  and(
                    eq(schema.bronzeUserAgentAccess.bronzeUserId, decoded.userId),
                    eq(schema.bronzeUserAgentAccess.agentConfigId, share.agentConfigId),
                    eq(schema.bronzeUserAgentAccess.userType, "gold"),
                    eq(schema.bronzeUserAgentAccess.isEnabled, false)
                  )
                )
                .limit(1);
              
              if (disabledAccess) {
                console.log(`🚫 [VALIDATE-SESSION] Agent disabled for this Gold user, agentConfigId: ${share.agentConfigId}`);
                return res.status(403).json({ 
                  error: 'Accesso negato: questo agente non è disponibile per il tuo account',
                  code: 'AGENT_DISABLED'
                });
              }
            }
            
            // Use subscriptionId as managerId for conversation queries (to find previous conversations)
            req.managerId = decoded.subscriptionId;
            req.tokenType = 'gold';
            console.log(`✅ [GOLD AUTH] Valid gold client token for share ${share.slug}, userId: ${decoded.userId}, subscriptionId: ${decoded.subscriptionId}`);
            return next();
          } else {
            console.log(`❌ [VALIDATE-SESSION] Gold client not found or inactive`);
          }
        }
        
        // Check for legacy Gold client (normal client user from users table without subscriptionId)
        // Gold clients have tokens with just userId (no type, role may or may not be present)
        if (decoded.userId && !decoded.type && !decoded.bronzeUserId && !decoded.subscriptionId) {
          console.log(`🏆 [VALIDATE-SESSION] Potential Gold client token, verifying user...`, { userId: decoded.userId, role: decoded.role });
          // Verify the client exists and is active
          const [goldClient] = await db.select()
            .from(schema.users)
            .where(
              and(
                eq(schema.users.id, decoded.userId),
                eq(schema.users.role, 'client'),
                eq(schema.users.isActive, true)
              )
            )
            .limit(1);
          
          console.log(`🏆 [VALIDATE-SESSION] Gold client found: ${!!goldClient}, isActive: ${goldClient?.isActive}`);
          
          if (goldClient) {
            // Check if this agent is disabled for this Gold user (with userType to avoid collisions)
            if (share.agentConfigId) {
              const [disabledAccess] = await db.select()
                .from(schema.bronzeUserAgentAccess)
                .where(
                  and(
                    eq(schema.bronzeUserAgentAccess.bronzeUserId, decoded.userId),
                    eq(schema.bronzeUserAgentAccess.agentConfigId, share.agentConfigId),
                    eq(schema.bronzeUserAgentAccess.userType, "gold"),
                    eq(schema.bronzeUserAgentAccess.isEnabled, false)
                  )
                )
                .limit(1);
              
              if (disabledAccess) {
                console.log(`🚫 [VALIDATE-SESSION] Agent disabled for this Gold user, agentConfigId: ${share.agentConfigId}`);
                return res.status(403).json({ 
                  error: 'Accesso negato: questo agente non è disponibile per il tuo account',
                  code: 'AGENT_DISABLED'
                });
              }
            }
            
            req.managerId = decoded.userId; // Use userId as managerId for compatibility
            req.tokenType = 'gold';
            console.log(`✅ [GOLD AUTH] Valid gold client token for share ${share.slug}, userId: ${decoded.userId}`);
            return next();
          } else {
            console.log(`❌ [VALIDATE-SESSION] Gold client not found or inactive`);
          }
        }
        
        console.log(`⚠️ [VALIDATE-SESSION] Token valid but no matching auth type. type=${decoded.type}, role=${decoded.role}, shareId=${decoded.shareId}, expectedShareId=${share.id}`);
      }
    }
    
    // If share is public, no session needed
    if (share.accessType === 'public') {
      return next();
    }
    
    // For password-protected shares, verify visitor session
    // SECURITY: Only accept visitorId from query params (validated source)
    // Do not accept from body to prevent session spoofing attacks
    const visitorId = req.query.visitorId;
    
    if (!visitorId) {
      return res.status(401).json({ 
        error: 'Sessione visitatore richiesta',
        requiresPassword: share.accessType === 'password',
      });
    }
    
    // Verify session exists and not expired
    const isValid = await shareService.verifyVisitorSession(share.id, visitorId as string);
    
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Sessione scaduta o non valida',
        requiresPassword: share.accessType === 'password',
      });
    }
    
    next();
  } catch (error: any) {
    console.error('Visitor session validation error:', error);
    res.status(500).json({ error: 'Errore validazione sessione' });
  }
}

/**
 * Bronze User info attached to request for Level 1 agents
 */
interface BronzeUserInfo {
  bronzeUserId: string;
  consultantId: string;
  email: string;
  dailyMessagesUsed: number;
  dailyMessageLimit: number;
}

/**
 * Middleware to validate Bronze auth for Level 1 agents
 * Extracts and verifies Bronze JWT token from Authorization header
 */
async function validateBronzeAuth(
  req: Request & { share?: schema.WhatsappAgentShare; bronzeUser?: BronzeUserInfo },
  res: Response,
  next: NextFunction
) {
  try {
    const share = req.share;
    console.log(`\n🔒 [VALIDATE-BRONZE-AUTH] Share: ${share?.slug}`);
    
    if (!share) {
      console.log(`❌ [VALIDATE-BRONZE-AUTH] Share not found in request context`);
      return res.status(500).json({ error: 'Share non trovato in request context' });
    }
    
    // Get agent config to check level
    const [agentConfig] = await db
      .select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, share.agentConfigId))
      .limit(1);
    
    if (!agentConfig) {
      console.log(`❌ [VALIDATE-BRONZE-AUTH] Agent config not found`);
      return res.status(404).json({ error: 'Configurazione agente non trovata' });
    }
    
    // Only require Bronze auth for Level 1 agents
    // Check both legacy 'level' field and new 'levels' array
    const hasLevel1 = agentConfig.level === "1" || (agentConfig.levels && agentConfig.levels.includes("1"));
    console.log(`🔒 [VALIDATE-BRONZE-AUTH] Agent level: ${agentConfig.level}, levels: ${JSON.stringify(agentConfig.levels)}, hasLevel1: ${hasLevel1}`);
    
    if (!hasLevel1) {
      console.log(`✅ [VALIDATE-BRONZE-AUTH] Not a Level 1 agent, skipping Bronze auth`);
      return next();
    }
    
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    console.log(`🔑 [VALIDATE-BRONZE-AUTH] Auth header present: ${!!authHeader}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [VALIDATE-BRONZE-AUTH] No Bearer token found`);
      return res.status(401).json({ 
        error: 'Autenticazione Bronze richiesta',
        requiresBronzeAuth: true,
      });
    }
    
    const token = authHeader.slice(7);
    // Try JWT_SECRET first (used by unified login), then SESSION_SECRET
    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    const sessionSecret = process.env.SESSION_SECRET;
    
    // Try to decode with JWT_SECRET first
    let decoded: any = null;
    try {
      decoded = jwt.verify(token, jwtSecret) as any;
      console.log(`📜 [VALIDATE-BRONZE-AUTH] Token decoded with JWT_SECRET:`, { type: decoded.type, bronzeUserId: decoded.bronzeUserId, subscriptionId: decoded.subscriptionId });
    } catch (e) {
      console.log(`⚠️ [VALIDATE-BRONZE-AUTH] JWT_SECRET verification failed: ${(e as Error).message}`);
      // Try SESSION_SECRET as fallback
      if (sessionSecret) {
        try {
          decoded = jwt.verify(token, sessionSecret) as any;
          console.log(`📜 [VALIDATE-BRONZE-AUTH] Token decoded with SESSION_SECRET:`, { type: decoded.type, bronzeUserId: decoded.bronzeUserId, subscriptionId: decoded.subscriptionId });
        } catch (e2) {
          console.log(`⚠️ [VALIDATE-BRONZE-AUTH] SESSION_SECRET verification failed: ${(e2 as Error).message}`);
        }
      }
    }
    
    if (!decoded) {
      console.log(`❌ [VALIDATE-BRONZE-AUTH] Token verification failed with all secrets`);
      return res.status(401).json({ 
        error: 'Token non valido',
        requiresBronzeAuth: true,
      });
    }
    
    console.log(`📜 [VALIDATE-BRONZE-AUTH] Token decoded:`, { type: decoded.type, bronzeUserId: decoded.bronzeUserId, subscriptionId: decoded.subscriptionId, userId: decoded.userId, consultantId: decoded.consultantId, agentConsultantId: agentConfig.consultantId });
    
    // Silver users have unlimited messages - skip Bronze limits check
    if (decoded.type === 'silver') {
      console.log(`✅ [VALIDATE-BRONZE-AUTH] Silver user detected, skipping Bronze limits (Silver has unlimited messages)`);
      return next();
    }
    
    // Gold users (regular clients from users table) - check by userId without type field
    // SECURITY: Only tokens without type, subscriptionId, bronzeUserId can be Gold
    // The database query verifies role='client' to prevent consultant bypass
    if (!decoded.type && decoded.userId && !decoded.subscriptionId && !decoded.bronzeUserId) {
      console.log(`🥇 [VALIDATE-BRONZE-AUTH] Checking if userId is a Gold client...`, { userId: decoded.userId, profileId: decoded.profileId });
      const [goldUser] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, decoded.userId),
            eq(schema.users.role, 'client'),
            eq(schema.users.isActive, true)
          )
        )
        .limit(1);
      
      if (goldUser) {
        // Verify Gold user belongs to this agent's consultant
        if (goldUser.consultantId === agentConfig.consultantId) {
          console.log(`✅ [GOLD AUTH] Valid Gold client: ${goldUser.email}`);
          return next();
        } else {
          console.log(`❌ [GOLD AUTH] Gold client ${goldUser.email} does not belong to agent's consultant`);
          return res.status(403).json({ 
            error: 'Token Gold non valido per questo agente',
            requiresBronzeAuth: true,
          });
        }
      }
      console.log(`⚠️ [VALIDATE-BRONZE-AUTH] userId present but not a valid Gold client`);
    }
    
    // Verify token type is "bronze" for non-Silver/non-Gold users
    if (decoded.type !== 'bronze') {
      console.log(`❌ [VALIDATE-BRONZE-AUTH] Token type is not 'bronze', 'silver', or Gold: ${decoded.type}`);
      return res.status(401).json({ 
        error: 'Token non valido per utenti Bronze',
        requiresBronzeAuth: true,
      });
    }
    
    // Verify consultantId matches the agent's consultant
    if (decoded.consultantId !== agentConfig.consultantId) {
      return res.status(403).json({ 
        error: 'Token Bronze non valido per questo agente',
        requiresBronzeAuth: true,
      });
    }
    
    // Get Bronze user data for message limits
    const [bronzeUser] = await db
      .select()
      .from(schema.bronzeUsers)
      .where(eq(schema.bronzeUsers.id, decoded.bronzeUserId))
      .limit(1);
    
    if (!bronzeUser) {
      return res.status(401).json({ 
        error: 'Utente Bronze non trovato',
        requiresBronzeAuth: true,
      });
    }
    
    if (!bronzeUser.isActive) {
      return res.status(403).json({ 
        error: 'Account Bronze disattivato',
        requiresBronzeAuth: true,
      });
    }
    
    // Get the monthly limit from consultant's pricing settings (pricingPageConfig in users table)
    const [consultantData] = await db
      .select({ pricingPageConfig: schema.users.pricingPageConfig })
      .from(schema.users)
      .where(eq(schema.users.id, bronzeUser.consultantId))
      .limit(1);
    
    // Use consultant's configured limit, fallback to 100 (monthly max)
    const monthlyLimit = (consultantData?.pricingPageConfig as any)?.level1DailyMessageLimit || 100;
    
    // Attach Bronze user info to request
    req.bronzeUser = {
      bronzeUserId: bronzeUser.id,
      consultantId: bronzeUser.consultantId,
      email: bronzeUser.email,
      dailyMessagesUsed: bronzeUser.dailyMessagesUsed,
      dailyMessageLimit: monthlyLimit,
    };
    
    console.log(`✅ [BRONZE AUTH] Valid token for user ${bronzeUser.email}, monthly limit: ${monthlyLimit}`);
    next();
  } catch (error: any) {
    console.error('Bronze auth validation error:', error);
    res.status(500).json({ error: 'Errore validazione Bronze auth' });
  }
}

/**
 * Helper function to check if it's a new month (for message limit reset)
 * Cambiato da giornaliero a mensile
 */
function isNewMonth(lastResetAt: Date | null): boolean {
  if (!lastResetAt) return true;
  const now = new Date();
  const lastReset = new Date(lastResetAt);
  // Reset se siamo in un mese diverso o anno diverso
  return now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
}

/**
 * Middleware to validate share exists and is active
 */
async function validateShareExists(
  req: Request & { share?: schema.WhatsappAgentShare; bronzeAgent?: typeof schema.consultantWhatsappConfig.$inferSelect },
  res: Response,
  next: NextFunction
) {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({ error: 'Slug mancante' });
    }
    
    // First try to get share from whatsappAgentShares (legacy Manager system)
    const share = await shareService.getShareBySlug(slug);
    if (share) {
      // Validate basic access (active, not expired, not revoked)
      const validation = await shareService.validateShareById(share.id);
      if (!validation.valid) {
        return res.status(403).json({ 
          error: validation.reason || 'Accesso negato',
        });
      }
      
      // Attach share to request for next middleware
      req.share = share;
      return next();
    }
    
    // Not found in shares - try to find by public_slug in consultantWhatsappConfig (Bronze/Level 1 system)
    let [agentConfig] = await db.select()
      .from(schema.consultantWhatsappConfig)
      .where(and(
        eq(schema.consultantWhatsappConfig.publicSlug, slug),
        eq(schema.consultantWhatsappConfig.isActive, true)
      ))
      .limit(1);

    // If not found by publicSlug, try to find by ID (for Gold preview access and agents without slug)
    if (!agentConfig) {
      [agentConfig] = await db.select()
        .from(schema.consultantWhatsappConfig)
        .where(and(
          eq(schema.consultantWhatsappConfig.id, slug),
          eq(schema.consultantWhatsappConfig.isActive, true)
        ))
        .limit(1);
    }

    if (!agentConfig) {
      return res.status(404).json({ error: 'Condivisione non trovata' });
    }

    // Create a virtual share object for Bronze agents
    // Note: Bronze auth is handled via requiresBronzeAuth in metadata, not requiresLogin
    // requiresLogin is for manager authentication (a different system)
    const virtualShare = {
      id: `bronze-${agentConfig.id}`,
      slug: slug,
      agentConfigId: agentConfig.id,
      agentName: agentConfig.agentName || "AI Assistant",
      consultantId: agentConfig.consultantId,
      isActive: true,
      accessType: 'public' as const,
      requiresLogin: false, // Bronze uses requiresBronzeAuth instead
      expireAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      allowedDomains: null,
    } as schema.WhatsappAgentShare;

    req.share = virtualShare;
    req.bronzeAgent = agentConfig;
    next();
  } catch (error: any) {
    console.error('Share validation error:', error);
    res.status(500).json({ error: 'Errore validazione condivisione' });
  }
}

/**
 * GET /public/whatsapp/shares/:slug/metadata
 * Get public metadata about the share (no auth required)
 */
router.get('/:slug/metadata', validateShareExists, async (req: Request & { share?: schema.WhatsappAgentShare }, res) => {
  try {
    const share = req.share!;
    
    // Get agent config for business info
    const [agentConfig] = await db
      .select()
      .from(schema.consultantWhatsappConfig)
      .where(eq(schema.consultantWhatsappConfig.id, share.agentConfigId))
      .limit(1);
    
    // Get consultant info for Bronze auth redirect (pricingPageSlug)
    let consultantSlug: string | null = null;
    if (agentConfig) {
      const [consultant] = await db
        .select({ pricingPageSlug: schema.users.pricingPageSlug, username: schema.users.username })
        .from(schema.users)
        .where(eq(schema.users.id, agentConfig.consultantId))
        .limit(1);
      consultantSlug = consultant?.pricingPageSlug || consultant?.username || null;
    }
    
    // Determine if Bronze auth is required (Level 1 agents)
    // Check both legacy 'level' field and new 'levels' array
    const agentLevel = agentConfig?.level || null;
    const agentLevels = agentConfig?.levels || null;
    const hasLevel1 = agentLevel === "1" || (agentLevels && agentLevels.includes("1"));
    const requiresBronzeAuth = hasLevel1;
    
    // Return public metadata with business info
    res.json({
      success: true,
      metadata: {
        agentName: share.agentName,
        accessType: share.accessType,
        requiresPassword: share.accessType === 'password',
        requiresLogin: share.requiresLogin || false,
        isActive: share.isActive,
        isExpired: share.expireAt ? new Date(share.expireAt) < new Date() : false,
        hasDomainsWhitelist: share.allowedDomains && share.allowedDomains.length > 0,
        level: agentLevel,
        requiresBronzeAuth,
        consultantSlug,
        businessInfo: agentConfig ? {
          businessName: agentConfig.businessName || null,
          businessDescription: agentConfig.businessDescription || null,
          consultantName: agentConfig.consultantDisplayName || null,
          consultantBio: agentConfig.consultantBio || null,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching share metadata:', error);
    res.status(500).json({ error: 'Errore durante il recupero dei metadati' });
  }
});

/**
 * POST /public/whatsapp/shares/:slug/validate
 * Validate password and create visitor session
 */
router.post('/:slug/validate', validateShareExists, async (req: Request & { share?: schema.WhatsappAgentShare }, res) => {
  try {
    const share = req.share!;
    const { password } = req.body;
    
    // Check if this is a virtual Bronze share (not in database)
    const isBronzeVirtualShare = share.id.startsWith('bronze-');
    
    // If public access, generate visitor ID immediately
    if (share.accessType === 'public') {
      const visitorId = nanoid(16);
      
      // Create session only for real shares (not virtual Bronze shares)
      // Virtual Bronze shares don't exist in the database, so we can't create FK references
      if (!isBronzeVirtualShare) {
        await shareService.createVisitorSession(share.id, visitorId, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          referrer: req.get('referer'),
        });
      }
      
      return res.json({
        success: true,
        accessGranted: true,
        visitorId,
        agentName: share.agentName,
      });
    }
    
    // Password-protected share
    if (share.accessType === 'password') {
      if (!password) {
        return res.status(400).json({ error: 'Password richiesta' });
      }
      
      // Verify password
      const isValidPassword = await shareService.checkPassword(share.id, password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Password non valida' });
      }
      
      // Generate visitor ID
      const visitorId = nanoid(16);
      
      // Create authenticated visitor session only for real shares
      if (!isBronzeVirtualShare) {
        await shareService.createVisitorSession(share.id, visitorId, {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          referrer: req.get('referer'),
        });
      }
      
      return res.json({
        success: true,
        accessGranted: true,
        visitorId,
        agentName: share.agentName,
      });
    }
    
    // Token-based access (not implemented yet)
    res.status(501).json({ error: 'Accesso token non ancora implementato' });
  } catch (error: any) {
    console.error('Error validating share access:', error);
    res.status(500).json({ error: 'Errore durante la validazione dell\'accesso' });
  }
});

/**
 * GET /public/whatsapp/shares/:slug/conversation
 * Get conversation history for a visitor
 */
router.get(
  '/:slug/conversation', 
  validateShareExists,
  validateDomainAccess,
  validateVisitorSession,
  async (req: Request & { share?: schema.WhatsappAgentShare; managerId?: string; tokenType?: 'bronze' | 'silver' | 'gold' | 'manager' }, res) => {
    try {
      const managerId = req.managerId;
      const visitorId = req.query.visitorId as string;
      const conversationId = req.query.conversationId as string;
      const share = req.share!;
      const tokenType = (req as any).tokenType as 'bronze' | 'silver' | 'gold' | 'manager' | undefined;
      
      // For managers, get ALL their conversations (they can have multiple)
      if (managerId) {
        const managerVisitorPattern = `manager_${managerId}%`;
        
        // Check if this is a Bronze virtual share (ID starts with "bronze-")
        const isBronzeShare = share.id.startsWith('bronze-');
        
        // For Silver/Gold users, we need to search for conversations with ANY shareId
        // because their conversations may have been migrated from Bronze (NULL shareId) to a real shareId
        const isSilverOrGold = tokenType === 'silver' || tokenType === 'gold';
        
        console.log(`[CONV DEBUG] managerId: ${managerId}, shareId: ${share.id}, agentConfigId: ${share.agentConfigId}, isBronzeShare: ${isBronzeShare}, tokenType: ${tokenType}, isSilverOrGold: ${isSilverOrGold}, pattern: ${managerVisitorPattern}`);
        
        // Get all conversations for this manager
        // For Silver/Gold users: search by agentConfigId and externalVisitorId ONLY (ignore shareId)
        //   This finds both old Bronze conversations (NULL shareId) and migrated ones (any shareId)
        // For Bronze users on virtual shares: search NULL shareId only
        // For real shares (password-protected etc): search by that specific shareId
        let conversations;
        
        if (isSilverOrGold) {
          // Silver/Gold: Find conversations with NULL shareId (old Bronze) OR ANY real shareId for this agent
          // Get ALL shares for this agent to search across all of them
          const agentShares = await db
            .select({ id: schema.whatsappAgentShares.id })
            .from(schema.whatsappAgentShares)
            .where(eq(schema.whatsappAgentShares.agentConfigId, share.agentConfigId));
          
          const shareIds = agentShares.map(s => s.id);
          console.log(`[CONV DEBUG] Silver/Gold query - found ${shareIds.length} shares for agent: ${shareIds.join(', ')}`);
          
          // Build query: NULL shareId (old Bronze) OR any of the agent's shareIds
          if (shareIds.length === 0) {
            // No real shares, only search NULL
            conversations = await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  sql`${schema.whatsappAgentConsultantConversations.shareId} IS NULL`,
                  sql`${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${managerVisitorPattern}`
                )
              )
              .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
          } else {
            // Search NULL OR any of the agent's shares
            conversations = await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  sql`(${schema.whatsappAgentConsultantConversations.shareId} IS NULL OR ${schema.whatsappAgentConsultantConversations.shareId} IN (${sql.join(shareIds.map(id => sql`${id}`), sql`, `)}))`,
                  sql`${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${managerVisitorPattern}`
                )
              )
              .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
          }
        } else if (isBronzeShare) {
          // Bronze on virtual share: search NULL shareId
          // FALLBACK: Also check if this Bronze user was upgraded - search for migrated conversations too
          const bronzeUserId = managerId;
          let migratedSubscriptionId: string | null = null;
          
          // Check if this Bronze user was upgraded to Silver/Gold
          const [bronzeUserData] = await db.select({
            upgradedSubscriptionId: schema.bronzeUsers.upgradedSubscriptionId,
          })
            .from(schema.bronzeUsers)
            .where(eq(schema.bronzeUsers.id, bronzeUserId))
            .limit(1);
          
          if (bronzeUserData?.upgradedSubscriptionId) {
            migratedSubscriptionId = bronzeUserData.upgradedSubscriptionId;
            console.log(`[CONV DEBUG] Bronze user ${bronzeUserId} was upgraded, also searching for subscriptionId ${migratedSubscriptionId}`);
          }
          
          // Build pattern(s) for search - include both bronzeUserId and subscriptionId if upgraded
          const patterns = [`manager_${bronzeUserId}%`];
          if (migratedSubscriptionId) {
            patterns.push(`manager_${migratedSubscriptionId}%`);
          }
          
          // Search for conversations matching any pattern
          if (patterns.length === 1) {
            conversations = await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  sql`${schema.whatsappAgentConsultantConversations.shareId} IS NULL`,
                  sql`${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${patterns[0]}`
                )
              )
              .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
          } else {
            // Search for both patterns (bronzeUserId OR subscriptionId)
            const [realShare] = await db
              .select({ id: schema.whatsappAgentShares.id })
              .from(schema.whatsappAgentShares)
              .where(eq(schema.whatsappAgentShares.agentConfigId, share.agentConfigId))
              .limit(1);
            const realShareId = realShare?.id || null;
            
            conversations = await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  realShareId
                    ? sql`(${schema.whatsappAgentConsultantConversations.shareId} IS NULL OR ${schema.whatsappAgentConsultantConversations.shareId} = ${realShareId})`
                    : sql`${schema.whatsappAgentConsultantConversations.shareId} IS NULL`,
                  sql`(${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${patterns[0]} OR ${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${patterns[1]})`
                )
              )
              .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
          }
        } else {
          // Real share (password-protected, manager link, etc): search by specific shareId
          conversations = await db
            .select()
            .from(schema.whatsappAgentConsultantConversations)
            .where(
              and(
                eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                eq(schema.whatsappAgentConsultantConversations.shareId, share.id),
                sql`${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${managerVisitorPattern}`
              )
            )
            .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));
        }
        
        console.log(`[CONV DEBUG] Found ${conversations.length} conversations`);
        
        // If conversationId is specified, get messages for that conversation
        if (conversationId) {
          const [targetConversation] = conversations.filter(c => c.id === conversationId);
          if (!targetConversation) {
            return res.json({
              success: true,
              conversations: conversations.map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.createdAt,
                lastMessageAt: c.lastMessageAt,
              })),
              conversation: null,
              messages: [],
            });
          }
          
          const messages = await db
            .select()
            .from(schema.whatsappAgentConsultantMessages)
            .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversationId))
            .orderBy(schema.whatsappAgentConsultantMessages.createdAt);
          
          return res.json({
            success: true,
            conversations: conversations.map(c => ({
              id: c.id,
              title: c.title,
              createdAt: c.createdAt,
              lastMessageAt: c.lastMessageAt,
            })),
            conversation: {
              id: targetConversation.id,
              createdAt: targetConversation.createdAt,
            },
            messages: messages.map(m => ({
              id: m.id,
              role: m.role,
              content: m.content,
              thinking: m.thinkingContent,
              createdAt: m.createdAt,
              audioUrl: m.audioUrl,
              audioDuration: m.audioDuration,
              transcription: m.transcription,
            })),
          });
        }
        
        // No specific conversation requested, return latest if exists
        if (conversations.length === 0) {
          return res.json({
            success: true,
            conversations: [],
            conversation: null,
            messages: [],
          });
        }
        
        const latestConversation = conversations[0];
        const messages = await db
          .select()
          .from(schema.whatsappAgentConsultantMessages)
          .where(eq(schema.whatsappAgentConsultantMessages.conversationId, latestConversation.id))
          .orderBy(schema.whatsappAgentConsultantMessages.createdAt);
        
        return res.json({
          success: true,
          conversations: conversations.map(c => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            lastMessageAt: c.lastMessageAt,
          })),
          conversation: {
            id: latestConversation.id,
            createdAt: latestConversation.createdAt,
          },
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            thinking: m.thinkingContent,
            createdAt: m.createdAt,
            audioUrl: m.audioUrl,
            audioDuration: m.audioDuration,
            transcription: m.transcription,
          })),
        });
      }
      
      // For regular visitors, use exact visitorId match
      if (!visitorId) {
        return res.status(400).json({ error: 'visitorId richiesto' });
      }
      
      // Get or create conversation
      const [conversation] = await db
        .select()
        .from(schema.whatsappAgentConsultantConversations)
        .where(
          and(
            eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
            eq(schema.whatsappAgentConsultantConversations.shareId, share.id),
            eq(schema.whatsappAgentConsultantConversations.externalVisitorId, visitorId as string)
          )
        )
        .limit(1);
      
      if (!conversation) {
        // No conversation yet
        return res.json({
          success: true,
          conversation: null,
          messages: [],
        });
      }
      
      // Get messages
      const messages = await db
        .select()
        .from(schema.whatsappAgentConsultantMessages)
        .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversation.id))
        .orderBy(schema.whatsappAgentConsultantMessages.createdAt);
      
      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          createdAt: conversation.createdAt,
        },
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          audioUrl: m.audioUrl,
          audioDuration: m.audioDuration,
          transcription: m.transcription,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ error: 'Errore durante il recupero della conversazione' });
    }
  }
);

/**
 * DELETE /public/whatsapp/shares/:slug/conversations/:conversationId
 * Delete a conversation and its messages (manager only)
 */
router.delete(
  '/:slug/conversations/:conversationId',
  validateShareExists,
  validateDomainAccess,
  validateVisitorSession,
  async (req: Request & { share?: schema.WhatsappAgentShare; managerId?: string }, res) => {
    try {
      const { conversationId } = req.params;
      const managerId = req.managerId;
      const share = req.share!;
      
      if (!managerId) {
        return res.status(401).json({ error: 'Solo i manager possono eliminare conversazioni' });
      }
      
      if (!conversationId) {
        return res.status(400).json({ error: 'ID conversazione mancante' });
      }
      
      console.log(`\n🗑️ [DELETE CONVERSATION] Manager ${managerId} deleting conversation ${conversationId}`);
      
      // Match any visitorId that starts with manager_{managerId} (includes timestamp suffix for new chats)
      const managerVisitorPattern = `manager_${managerId}%`;
      
      // For Silver/Bronze users, shareId may be NULL, so we need to handle both cases
      const [conversation] = await db
        .select()
        .from(schema.whatsappAgentConsultantConversations)
        .where(
          and(
            eq(schema.whatsappAgentConsultantConversations.id, conversationId),
            eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
            or(
              eq(schema.whatsappAgentConsultantConversations.shareId, share.id),
              sql`${schema.whatsappAgentConsultantConversations.shareId} IS NULL`
            ),
            sql`${schema.whatsappAgentConsultantConversations.externalVisitorId} LIKE ${managerVisitorPattern}`
          )
        )
        .limit(1);
      
      console.log(`   🔍 Query: conversationId=${conversationId}, agentConfigId=${share.agentConfigId}, managerPattern=${managerVisitorPattern}`);
      
      if (!conversation) {
        console.log(`   ❌ Conversation not found or access denied`);
        return res.status(404).json({ error: 'Conversazione non trovata o accesso negato' });
      }
      
      console.log(`   ✅ Conversation verified, deleting messages...`);
      await db
        .delete(schema.whatsappAgentConsultantMessages)
        .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversationId));
      
      console.log(`   ✅ Messages deleted, deleting conversation...`);
      await db
        .delete(schema.whatsappAgentConsultantConversations)
        .where(eq(schema.whatsappAgentConsultantConversations.id, conversationId));
      
      console.log(`   ✅ Conversation deleted successfully`);
      
      res.json({
        success: true,
        message: 'Conversazione eliminata con successo',
      });
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Errore durante l\'eliminazione della conversazione' });
    }
  }
);

/**
 * POST /public/whatsapp/shares/:slug/message
 * Send a message to the shared agent (STREAMING SSE)
 */
router.post(
  '/:slug/message',
  validateShareExists,
  validateDomainAccess,
  validateVisitorSession,
  validateBronzeAuth,
  async (req: Request & { share?: schema.WhatsappAgentShare; managerId?: string; bronzeUser?: BronzeUserInfo }, res) => {
    // SECURITY: Get visitorId from query OR use managerId from JWT (for manager_login shares)
    const managerId = req.managerId;
    const bronzeUser = req.bronzeUser;
    const baseVisitorId = bronzeUser 
      ? `bronze_${bronzeUser.bronzeUserId}` 
      : (managerId ? `manager_${managerId}` : (req.query.visitorId as string));
    const { message, preferences, newConversation, conversationId: requestedConversationId } = req.body;
    const share = req.share!;
    
    // For new conversations, generate unique visitorId to allow multiple conversations per manager
    // BUT if a conversationId is provided, ignore newConversation flag (user is continuing existing chat)
    const isActuallyNewConversation = newConversation && !requestedConversationId;
    const visitorId = isActuallyNewConversation && managerId 
      ? `manager_${managerId}_${Date.now()}` 
      : baseVisitorId;
    
    if (requestedConversationId && newConversation) {
      console.log(`⚠️ [MANAGER] newConversation=true but conversationId provided - ignoring newConversation flag`);
    }
    
    // Extract manager preferences if provided
    const managerPreferences = preferences ? {
      writingStyle: preferences.writingStyle as string | undefined,
      responseLength: preferences.responseLength as string | undefined,
      customInstructions: preferences.customInstructions as string | undefined,
      aiModel: preferences.aiModel as string | undefined,
      thinkingLevel: preferences.thinkingLevel as string | undefined,
    } : undefined;
    
    if (managerPreferences?.aiModel) {
      console.log(`🎛️ [MANAGER PREFS] Model: ${managerPreferences.aiModel}, Thinking: ${managerPreferences.thinkingLevel || 'default'}`);
    }
    
    const isManager = !!managerId;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📨 [PUBLIC-SHARE-STREAMING] New message from ${isManager ? 'MANAGER' : 'visitor'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔗 Share: ${share.slug} (${share.agentName})`);
    console.log(`👤 ${isManager ? 'Manager' : 'Visitor'}: ${visitorId}`);
    console.log(`📝 Message: "${message?.substring(0, 50) || '(empty)'}${message?.length > 50 ? '...' : ''}"`);
    
    try {
      if (!visitorId) {
        console.log(`❌ Missing visitorId/managerId`);
        return res.status(400).json({ error: 'visitorId richiesto' });
      }
      
      if (!message || !message.trim()) {
        console.log(`❌ Missing or empty message`);
        return res.status(400).json({ error: 'Messaggio richiesto' });
      }
      
      // Track access
      console.log(`\n📊 Tracking share access...`);
      await shareService.trackAccess(share.id);
      
      // Get agent config first (needed for TTS settings)
      console.log(`\n📥 Fetching agent configuration...`);
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, share.agentConfigId))
        .limit(1);
      
      if (!agentConfig) {
        console.error(`❌ Agent config not found: ${share.agentConfigId}`);
        return res.status(404).json({ error: 'Configurazione agente non trovata' });
      }
      
      console.log(`✅ Agent: ${agentConfig.agentName} (TTS: ${agentConfig.ttsEnabled}, Mode: ${agentConfig.audioResponseMode})`);
      
      // Bronze user message limit check (Level 1 agents only)
      let bronzeUsageInfo: { dailyMessagesUsed: number; dailyMessageLimit: number; remaining: number } | null = null;
      if (bronzeUser && agentConfig.level === "1") {
        console.log(`\n🔒 [BRONZE LIMIT] Checking monthly message limits for ${bronzeUser.email}...`);
        
        // Get fresh Bronze user data
        const [freshBronzeUser] = await db
          .select()
          .from(schema.bronzeUsers)
          .where(eq(schema.bronzeUsers.id, bronzeUser.bronzeUserId))
          .limit(1);
        
        if (!freshBronzeUser) {
          return res.status(401).json({ error: 'Utente Bronze non trovato' });
        }
        
        // Get the monthly limit from consultant's pricing settings (pricingPageConfig in users table)
        const [consultantData] = await db
          .select({ pricingPageConfig: schema.users.pricingPageConfig })
          .from(schema.users)
          .where(eq(schema.users.id, agentConfig.consultantId))
          .limit(1);
        
        // Use agent config limit first, then consultant's pricing settings, fallback to 100 (monthly max)
        const monthlyLimit = agentConfig.dailyMessageLimit 
          || (consultantData?.pricingPageConfig as any)?.level1DailyMessageLimit 
          || 100;
        
        let monthlyUsed = freshBronzeUser.dailyMessagesUsed;
        
        // Reset counter if new month
        if (isNewMonth(freshBronzeUser.lastMessageResetAt)) {
          console.log(`   📅 New month detected, resetting counter`);
          monthlyUsed = 0;
          await db
            .update(schema.bronzeUsers)
            .set({
              dailyMessagesUsed: 0,
              lastMessageResetAt: new Date(),
            })
            .where(eq(schema.bronzeUsers.id, bronzeUser.bronzeUserId));
        }
        
        // Check if limit reached - return SSE stream with friendly message instead of 429
        if (monthlyUsed >= monthlyLimit) {
          console.log(`   ⛔ Monthly limit reached: ${monthlyUsed}/${monthlyLimit}`);
          
          // Setup SSE headers for streaming response
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          
          const limitMessage = `Hey! 😊 Hai raggiunto il limite di ${monthlyLimit} messaggi mensili del piano Bronze gratuito.\n\nPuoi:\n• 🔄 **Attendere il prossimo mese** per altri ${monthlyLimit} messaggi gratis\n• ⬆️ **Passare al piano Argento** per messaggi illimitati e risposte più veloci\n\nClicca sull'icona del profilo in alto a destra per vedere le opzioni di upgrade! 🚀`;
          
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: limitMessage })}\n\n`);
          res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            conversationId: null,
            dailyMessagesUsed: monthlyUsed,
            dailyMessageLimit: monthlyLimit,
            remaining: 0,
            limitReached: true
          })}\n\n`);
          return res.end();
        }
        
        // Increment usage counter
        const newUsage = monthlyUsed + 1;
        await db
          .update(schema.bronzeUsers)
          .set({
            dailyMessagesUsed: newUsage,
          })
          .where(eq(schema.bronzeUsers.id, bronzeUser.bronzeUserId));
        
        bronzeUsageInfo = {
          dailyMessagesUsed: newUsage,
          dailyMessageLimit: monthlyLimit,
          remaining: monthlyLimit - newUsage,
        };
        
        console.log(`   ✅ Message allowed: ${newUsage}/${monthlyLimit} (remaining: ${bronzeUsageInfo.remaining})`);
      }
      
      // Get or create conversation
      console.log(`\n📥 Fetching or creating conversation...`);
      
      // Check if this is a Bronze virtual share (ID starts with "bronze-")
      const isBronzeShare = share.id.startsWith('bronze-');
      const actualShareId = isBronzeShare ? null : share.id;
      
      // If a specific conversationId is provided (manager continuing existing chat), use it directly
      let conversation: typeof schema.whatsappAgentConsultantConversations.$inferSelect | undefined;
      
      if (requestedConversationId && !newConversation) {
        console.log(`🔗 [MANAGER] Using provided conversationId: ${requestedConversationId}`);
        [conversation] = await db
          .select()
          .from(schema.whatsappAgentConsultantConversations)
          .where(eq(schema.whatsappAgentConsultantConversations.id, requestedConversationId))
          .limit(1);
        
        if (conversation) {
          console.log(`✅ Found conversation by ID: ${conversation.id}`);
        } else {
          console.log(`⚠️ Conversation not found by ID, falling back to visitorId lookup`);
        }
      }
      
      // Fall back to visitorId-based lookup if no conversation found
      if (!conversation) {
        // Query differently based on whether this is a Bronze share or regular share
        [conversation] = isBronzeShare
          ? await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  sql`${schema.whatsappAgentConsultantConversations.shareId} IS NULL`,
                  eq(schema.whatsappAgentConsultantConversations.externalVisitorId, visitorId)
                )
              )
              .limit(1)
          : await db
              .select()
              .from(schema.whatsappAgentConsultantConversations)
              .where(
                and(
                  eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
                  eq(schema.whatsappAgentConsultantConversations.shareId, share.id),
                  eq(schema.whatsappAgentConsultantConversations.externalVisitorId, visitorId)
                )
              )
              .limit(1);
      }
      
      if (!conversation) {
        console.log(`📝 No existing conversation, creating new one...`);
        
        // Create new conversation for visitor (use null shareId for Bronze)
        [conversation] = await db
          .insert(schema.whatsappAgentConsultantConversations)
          .values({
            consultantId: agentConfig.consultantId,
            agentConfigId: share.agentConfigId,
            shareId: actualShareId,
            externalVisitorId: visitorId,
            phoneNumber: null, // No phone for web visitors
            customerName: `Visitor ${visitorId.slice(0, 8)}`,
            conversationStatus: 'active',
            lastMessageAt: new Date(),
            visitorMetadata: {
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              referrer: req.get('referer'),
              firstAccessAt: new Date().toISOString(),
              isBronzeUser: isBronzeShare,
            },
          })
          .returning();
        
        console.log(`✅ Conversation created: ${conversation.id} (Bronze: ${isBronzeShare})`);
      } else {
        console.log(`✅ Existing conversation found: ${conversation.id}`);
      }
      
      // Save visitor message BEFORE streaming so AI can see conversation history
      console.log(`\n💾 Saving visitor message BEFORE streaming...`);
      await db.insert(schema.whatsappAgentConsultantMessages).values({
        conversationId: conversation.id,
        role: 'user',
        content: message,
        messageType: 'text',
      });
      console.log(`✅ Visitor message saved`);

      // Determine if we should send audio and/or text based on audioResponseMode BEFORE streaming
      // Client sent text, so clientSentAudio = false
      const responseDecision = agentConfig.ttsEnabled 
        ? shouldRespondWithAudio(agentConfig.audioResponseMode || 'always_text', false)
        : { sendAudio: false, sendText: true };
      
      // Track original decision for fallback detection
      const originalSendText = responseDecision.sendText;
      
      console.log(`🎛️ [AUDIO DECISION] Mode: ${agentConfig.audioResponseMode}, ClientSentText → sendAudio=${responseDecision.sendAudio}, sendText=${responseDecision.sendText}`);

      // Setup SSE headers
      console.log(`\n🔄 Setting up SSE streaming...`);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      let fullResponse = '';
      let audioUrl: string | null = null;
      let agentAudioDuration: number | null = null;
      const ACHERNAR_VOICE = 'Achernar';
      
      // ═══════════════════════════════════════════════════════════════════════
      // BOOKING - MODIFICA/CANCELLAZIONE/AGGIUNTA INVITATI (PRIMA DELLO STREAMING AI)
      // Come in message-processor.ts: gestisce le azioni su booking esistenti PRIMA
      // di chiamare l'AI, per evitare messaggi duplicati
      // ═══════════════════════════════════════════════════════════════════════
      let bookingResult: { created: boolean; modified: boolean; cancelled: boolean; attendeesAdded: boolean; booking?: any; googleMeetLink?: string; confirmationMessage?: string } = { created: false, modified: false, cancelled: false, attendeesAdded: false };
      let bookingActionCompleted = false;
      let pendingModification: PendingModificationContext | undefined = undefined;
      
      try {
        if (agentConfig.bookingEnabled !== false) {
          console.log(`\n📅 [PUBLIC-BOOKING-PRE] Checking for existing booking actions BEFORE AI streaming...`);
          
          // ══════════════════════════════════════════════════════════════════════
          // STEP 1: Verifica se esiste già un booking confermato
          // ══════════════════════════════════════════════════════════════════════
          const [existingBooking] = await db
            .select()
            .from(schema.appointmentBookings)
            .where(
              and(
                eq(schema.appointmentBookings.publicConversationId, conversation.id),
                eq(schema.appointmentBookings.status, 'confirmed')
              )
            )
            .limit(1);
          
          if (existingBooking) {
            console.log(`   ℹ️ Booking già esistente (ID: ${existingBooking.id}) - date: ${existingBooking.appointmentDate} ${existingBooking.appointmentTime}`);
            
            // ACCUMULATOR PATTERN: Always proceed with intent extraction (no pre-check skip)
            const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
            const _bookingSlug = (agentConfig.agentName || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            aiProvider.setFeature?.(`public-chat:${_bookingSlug}`);
            console.log(`   ✅ [ACCUMULATOR] Always proceeding with intent extraction (no pre-check skip)`);
              
              // Recupera cronologia conversazione (ultimi 15 messaggi)
              const recentMessages = await db
                .select()
                .from(schema.whatsappAgentConsultantMessages)
                .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversation.id))
                .orderBy(desc(schema.whatsappAgentConsultantMessages.createdAt))
                .limit(15);
              
              // Converti in formato richiesto dal booking service
              const conversationMessages: ConversationMessage[] = recentMessages
                .reverse()
                .map(m => ({
                  sender: m.role === 'user' ? 'client' as const : 'ai' as const,
                  messageText: m.content || ''
                }));
              
              console.log(`   📚 Analyzing ${conversationMessages.length} messages for intent...`);
              
              // Cast lastCompletedAction per type-safety
              const lastCompletedAction = existingBooking.lastCompletedAction as LastCompletedAction | null;
              
              const existingBookingForModification = {
                id: existingBooking.id,
                appointmentDate: existingBooking.appointmentDate!,
                appointmentTime: existingBooking.appointmentTime!,
                clientEmail: existingBooking.clientEmail,
                clientPhone: existingBooking.clientPhone,
                googleEventId: existingBooking.googleEventId
              };
              
              const modificationResult = await extractBookingDataFromConversation(
                conversationMessages,
                existingBookingForModification,
                aiProvider.client,
                'Europe/Rome'
              );
              
              if (modificationResult && 'intent' in modificationResult) {
                console.log(`   🎯 Intent detected: ${modificationResult.intent}, confirmedTimes: ${modificationResult.confirmedTimes}`);
                
                // Import Google Calendar functions
                const { updateGoogleCalendarEvent, deleteGoogleCalendarEvent, addAttendeesToGoogleCalendarEvent } = await import('../../google-calendar-service');
                const { consultantAvailabilitySettings } = await import('../../../shared/schema');
                
                // Get settings for timezone and duration
                const [settings] = await db
                  .select()
                  .from(consultantAvailabilitySettings)
                  .where(eq(consultantAvailabilitySettings.consultantId, agentConfig.consultantId))
                  .limit(1);
                  
                const timezone = settings?.timezone || "Europe/Rome";
                const duration = settings?.appointmentDuration || 60;
                
                if (modificationResult.intent === 'MODIFY' && modificationResult.newDate && modificationResult.newTime) {
                  // ══════════════════════════════════════════════════════════════════════
                  // MODIFICA APPUNTAMENTO - RICHIEDE 1 CONFERMA
                  // ══════════════════════════════════════════════════════════════════════
                  console.log(`   🔄 [MODIFY] Processing modification request...`);
                  
                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  const modifyDetails: ActionDetails = {
                    newDate: modificationResult.newDate,
                    newTime: modificationResult.newTime
                  };
                  if (isActionAlreadyCompleted(lastCompletedAction, 'MODIFY', modifyDetails)) {
                    console.log(`   ⏭️ [MODIFY] Skipping - same modification already completed recently`);
                    bookingActionCompleted = true; // Skip AI streaming for duplicate actions
                  } else if (modificationResult.confirmedTimes >= 1) {
                    console.log(`   ✅ [MODIFY] Confirmed - proceeding with modification`);
                    
                    // Update Google Calendar event if exists
                    if (existingBooking.googleEventId) {
                      try {
                        const success = await updateGoogleCalendarEvent(
                          agentConfig.consultantId,
                          existingBooking.googleEventId,
                          {
                            startDate: modificationResult.newDate,
                            startTime: modificationResult.newTime,
                            duration: duration,
                            timezone: timezone
                          },
                          agentConfig.id  // Use agent's calendar
                        );
                        
                        if (success) {
                          console.log(`   ✅ [MODIFY] Google Calendar event updated successfully`);
                        }
                      } catch (gcalError: any) {
                        console.error(`   ⚠️ [MODIFY] Failed to update Google Calendar: ${gcalError.message}`);
                      }
                    }
                    
                    // Calculate new end time
                    const [startHour, startMinute] = modificationResult.newTime.split(':').map(Number);
                    const totalMinutes = startHour * 60 + startMinute + duration;
                    const endHour = Math.floor(totalMinutes / 60) % 24;
                    const endMinute = totalMinutes % 60;
                    const formattedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
                    
                    // Update database con lastCompletedAction per prevenire duplicati
                    await db
                      .update(schema.appointmentBookings)
                      .set({
                        appointmentDate: modificationResult.newDate,
                        appointmentTime: modificationResult.newTime,
                        appointmentEndTime: formattedEndTime,
                        lastCompletedAction: {
                          type: 'MODIFY' as const,
                          completedAt: new Date().toISOString(),
                          triggerMessageId: conversation.id,
                          details: {
                            oldDate: existingBooking.appointmentDate,
                            oldTime: existingBooking.appointmentTime,
                            newDate: modificationResult.newDate,
                            newTime: modificationResult.newTime
                          }
                        }
                      })
                      .where(eq(schema.appointmentBookings.id, existingBooking.id));
                    
                    console.log(`   💾 [MODIFY] Database updated with lastCompletedAction`);
                    
                    // Costruisci messaggio di conferma modifica
                    const modifyConfirmationMessage = `✅ APPUNTAMENTO MODIFICATO!

📅 Nuovo appuntamento:
🗓️ Data: ${modificationResult.newDate.split('-').reverse().join('/')}
🕐 Orario: ${modificationResult.newTime}

Ti ho aggiornato l'invito al calendario all'indirizzo ${existingBooking.clientEmail}. Controlla la tua inbox! 📬

Ci vediamo alla nuova data! 🚀`;
                    
                    // Salva messaggio nel database
                    await db.insert(schema.whatsappAgentConsultantMessages).values({
                      conversationId: conversation.id,
                      role: 'agent',
                      content: modifyConfirmationMessage,
                      messageType: 'text',
                    });
                    
                    // Invia via SSE
                    res.write(`data: ${JSON.stringify({ type: 'chunk', content: modifyConfirmationMessage })}\n\n`);
                    
                    bookingResult.modified = true;
                    bookingResult.confirmationMessage = modifyConfirmationMessage;
                    bookingActionCompleted = true;
                    console.log(`   ✅ [MODIFY] Modification complete and confirmation sent! (AI streaming will be skipped)`);
                  } else {
                    console.log(`   ⏳ [MODIFY] Waiting for confirmation (${modificationResult.confirmedTimes}/1) - will proceed with AI streaming`);
                    // Set pending modification context for AI to ask for confirmation
                    pendingModification = {
                      intent: 'MODIFY',
                      newDate: modificationResult.newDate,
                      newTime: modificationResult.newTime,
                      confirmedTimes: modificationResult.confirmedTimes,
                      requiredConfirmations: 1
                    };
                  }
                  
                } else if (modificationResult.intent === 'CANCEL') {
                  // ══════════════════════════════════════════════════════════════════════
                  // CANCELLAZIONE APPUNTAMENTO - RICHIEDE 2 CONFERME
                  // ══════════════════════════════════════════════════════════════════════
                  console.log(`   🗑️ [CANCEL] Processing cancellation request...`);
                  
                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  if (isActionAlreadyCompleted(lastCompletedAction, 'CANCEL')) {
                    console.log(`   ⏭️ [CANCEL] Skipping - action already completed recently`);
                    bookingActionCompleted = true; // Skip AI streaming for duplicate actions
                  } else if (modificationResult.confirmedTimes >= 2) {
                    console.log(`   ✅ [CANCEL] Confirmed 2 times - proceeding with cancellation`);
                    
                    // Delete from Google Calendar if exists
                    let calendarDeleteSuccess = true;
                    if (existingBooking.googleEventId) {
                      try {
                        const success = await deleteGoogleCalendarEvent(
                          agentConfig.consultantId,
                          existingBooking.googleEventId,
                          agentConfig.id  // Use agent's calendar
                        );
                        
                        if (success) {
                          console.log(`   ✅ [CANCEL] Google Calendar event deleted successfully`);
                        } else {
                          console.log(`   ⚠️ [CANCEL] Failed to delete from Google Calendar`);
                          calendarDeleteSuccess = false;
                        }
                      } catch (gcalError: any) {
                        console.error(`   ⚠️ [CANCEL] Failed to delete from Google Calendar: ${gcalError.message}`);
                        calendarDeleteSuccess = false;
                      }
                    }
                    
                    // Update database status to cancelled con lastCompletedAction
                    await db
                      .update(schema.appointmentBookings)
                      .set({ 
                        status: 'cancelled',
                        lastCompletedAction: {
                          type: 'CANCEL' as const,
                          completedAt: new Date().toISOString(),
                          triggerMessageId: conversation.id,
                          details: {
                            oldDate: existingBooking.appointmentDate,
                            oldTime: existingBooking.appointmentTime
                          }
                        }
                      })
                      .where(eq(schema.appointmentBookings.id, existingBooking.id));
                    
                    console.log(`   💾 [CANCEL] Database updated with lastCompletedAction`);
                    
                    // Costruisci messaggio di conferma cancellazione
                    const cancelConfirmationMessage = calendarDeleteSuccess 
                      ? `✅ APPUNTAMENTO CANCELLATO

Ho cancellato il tuo appuntamento del ${existingBooking.appointmentDate!.split('-').reverse().join('/')} alle ${existingBooking.appointmentTime}.

Se in futuro vorrai riprogrammare, sarò qui per aiutarti! 😊`
                      : `⚠️ APPUNTAMENTO CANCELLATO (verifica calendario)

Ho cancellato il tuo appuntamento del ${existingBooking.appointmentDate!.split('-').reverse().join('/')} alle ${existingBooking.appointmentTime} dal sistema.

⚠️ Nota: C'è stato un problema nell'aggiornamento del tuo Google Calendar. Per favore, verifica manualmente che l'evento sia stato rimosso.

Se vuoi riprogrammare in futuro, scrivimi! 😊`;
                    
                    // Salva messaggio nel database
                    await db.insert(schema.whatsappAgentConsultantMessages).values({
                      conversationId: conversation.id,
                      role: 'agent',
                      content: cancelConfirmationMessage,
                      messageType: 'text',
                    });
                    
                    // Invia via SSE
                    res.write(`data: ${JSON.stringify({ type: 'chunk', content: cancelConfirmationMessage })}\n\n`);
                    
                    bookingResult.cancelled = true;
                    bookingResult.confirmationMessage = cancelConfirmationMessage;
                    bookingActionCompleted = true;
                    console.log(`   ✅ [CANCEL] Cancellation complete and confirmation sent! (AI streaming will be skipped)`);
                  } else {
                    console.log(`   ⏳ [CANCEL] Waiting for more confirmations (${modificationResult.confirmedTimes}/2) - will proceed with AI streaming`);
                    // Set pending modification context for AI to ask for confirmation
                    pendingModification = {
                      intent: 'CANCEL',
                      confirmedTimes: modificationResult.confirmedTimes,
                      requiredConfirmations: 2
                    };
                  }
                  
                } else if (modificationResult.intent === 'ADD_ATTENDEES' && modificationResult.attendees && modificationResult.attendees.length > 0) {
                  // ══════════════════════════════════════════════════════════════════════
                  // AGGIUNTA INVITATI - NESSUNA CONFERMA NECESSARIA
                  // ══════════════════════════════════════════════════════════════════════
                  console.log(`   👥 [ADD_ATTENDEES] Processing add attendees request...`);
                  console.log(`   📧 Attendees to add: ${modificationResult.attendees.join(', ')}`);
                  
                  // CHECK ANTI-DUPLICATO: Verifica se questa azione è già stata completata di recente
                  const addAttendeesDetails: ActionDetails = {
                    attendees: modificationResult.attendees
                  };
                  if (isActionAlreadyCompleted(lastCompletedAction, 'ADD_ATTENDEES', addAttendeesDetails)) {
                    console.log(`   ⏭️ [ADD_ATTENDEES] Skipping - same attendees already added recently`);
                    bookingActionCompleted = true; // Skip AI streaming for duplicate actions
                  } else if (existingBooking.googleEventId) {
                    try {
                      const result = await addAttendeesToGoogleCalendarEvent(
                        agentConfig.consultantId,
                        existingBooking.googleEventId,
                        modificationResult.attendees,
                        agentConfig.id  // Use agent's calendar
                      );
                      
                      console.log(`   ✅ [ADD_ATTENDEES] Google Calendar updated - ${result.added} added, ${result.skipped} already invited`);
                      
                      // Costruisci messaggio di conferma
                      const addAttendeesMessage = result.added > 0
                        ? `✅ INVITATI AGGIUNTI!

Ho aggiunto ${result.added} ${result.added === 1 ? 'invitato' : 'invitati'} all'appuntamento del ${existingBooking.appointmentDate!.split('-').reverse().join('/')} alle ${existingBooking.appointmentTime}.

${result.skipped > 0 ? `ℹ️ ${result.skipped} ${result.skipped === 1 ? 'era già invitato' : 'erano già invitati'}.\n\n` : ''}📧 Gli inviti Google Calendar sono stati inviati automaticamente! 📬`
                        : `ℹ️ Tutti gli invitati sono già stati aggiunti all'appuntamento del ${existingBooking.appointmentDate!.split('-').reverse().join('/')} alle ${existingBooking.appointmentTime}. 

Nessuna modifica necessaria! ✅`;
                      
                      // Salva messaggio nel database
                      await db.insert(schema.whatsappAgentConsultantMessages).values({
                        conversationId: conversation.id,
                        role: 'agent',
                        content: addAttendeesMessage,
                        messageType: 'text',
                      });
                      
                      // Invia via SSE
                      res.write(`data: ${JSON.stringify({ type: 'chunk', content: addAttendeesMessage })}\n\n`);
                      
                      // Salva lastCompletedAction per prevenire duplicati
                      await db
                        .update(schema.appointmentBookings)
                        .set({
                          lastCompletedAction: {
                            type: 'ADD_ATTENDEES' as const,
                            completedAt: new Date().toISOString(),
                            triggerMessageId: conversation.id,
                            details: {
                              attendeesAdded: modificationResult.attendees
                            }
                          }
                        })
                        .where(eq(schema.appointmentBookings.id, existingBooking.id));
                      
                      bookingResult.attendeesAdded = true;
                      bookingResult.confirmationMessage = addAttendeesMessage;
                      bookingActionCompleted = true;
                      console.log(`   ✅ [ADD_ATTENDEES] Confirmation with lastCompletedAction saved! (AI streaming will be skipped)`);
                      
                    } catch (gcalError: any) {
                      console.error(`   ⚠️ [ADD_ATTENDEES] Failed to add attendees: ${gcalError.message}`);
                      
                      const errorMessage = `⚠️ Mi dispiace, ho riscontrato un errore nell'aggiungere gli invitati al calendario.

Per favore riprova o aggiungili manualmente dal tuo Google Calendar. 🙏`;
                      
                      await db.insert(schema.whatsappAgentConsultantMessages).values({
                        conversationId: conversation.id,
                        role: 'agent',
                        content: errorMessage,
                        messageType: 'text',
                      });
                      
                      res.write(`data: ${JSON.stringify({ type: 'chunk', content: errorMessage })}\n\n`);
                      bookingActionCompleted = true; // Still skip AI since we sent an error message
                    }
                  } else {
                    console.log(`   ⚠️ [ADD_ATTENDEES] No Google Event ID found - cannot add attendees, will proceed with AI streaming`);
                  }
                  
                } else {
                  console.log(`   💬 [NONE] No modification/cancellation/add attendees intent - will proceed with AI streaming`);
                }
              }
          } else {
            console.log(`   ℹ️ No existing booking for this conversation - will proceed with AI streaming`);
          }
        }
      } catch (preBookingError: any) {
        console.error(`   ❌ [PUBLIC-BOOKING-PRE] Error checking existing booking: ${preBookingError.message}`);
        // Non bloccare - procedi con lo streaming AI normale
      }
      // ═══════════════════════════════════════════════════════════════════════
      
      // ═══════════════════════════════════════════════════════════════════════
      // SLOT FETCHING - Recupera slot disponibili REALI dal calendario
      // Critico per evitare che l'AI proponga orari già occupati
      // ═══════════════════════════════════════════════════════════════════════
      let bookingContextForAI: BookingContext | undefined = undefined;
      
      if (agentConfig.bookingEnabled !== false && !bookingActionCompleted) {
        try {
          console.log(`\n📅 [PUBLIC-SLOTS] Fetching available slots for AI context...`);
          
          let availableSlots: any[] = [];
          
          // Step 1: Check for saved slots in database (using publicConversationId for public share)
          const [savedSlots] = await db
            .select()
            .from(schema.proposedAppointmentSlots)
            .where(
              and(
                eq(schema.proposedAppointmentSlots.publicConversationId, conversation.id),
                eq(schema.proposedAppointmentSlots.usedForBooking, false),
                sql`${schema.proposedAppointmentSlots.expiresAt} > NOW()`
              )
            )
            .orderBy(desc(schema.proposedAppointmentSlots.proposedAt))
            .limit(1);
          
          if (savedSlots && savedSlots.slots) {
            // Check if lead is asking for fresh/different slots
            const refreshKeywords = ['altri orari', 'altre date', 'altri giorni', 'altri slot', 'nuovi orari', 'diversi orari', 'cambiare orario', 'non mi vanno', 'non va bene nessuno', 'nessuno di questi', 'altri disponibili', 'settimana prossima', 'la prossima settimana'];
            const isAskingRefresh = refreshKeywords.some(kw => (message || '').toLowerCase().includes(kw));
            
            if (isAskingRefresh) {
              console.log(`   🔄 [PUBLIC-SLOTS] Lead asking for fresh slots - forcing calendar refresh`);
              availableSlots = [];
              await db.delete(schema.proposedAppointmentSlots).where(eq(schema.proposedAppointmentSlots.id, savedSlots.id));
            } else {
              availableSlots = savedSlots.slots as any[];
              console.log(`   💾 [PUBLIC-SLOTS] Retrieved ${availableSlots.length} saved slots from DB cache (no calendar API call needed)`);
            }
          } else {
            // Step 2: Fetch fresh slots from calendar API
            console.log(`   🌐 [PUBLIC-SLOTS] No saved slots found - fetching from calendar API...`);
            
            // Use agent's maxDaysAhead configuration (default 30 days)
            const maxDaysAhead = agentConfig?.availabilityMaxDaysAhead || 30;
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + maxDaysAhead);
            
            try {
              const slotsResponse = await fetch(
                `http://localhost:${process.env.PORT || 5000}/api/calendar/available-slots?` +
                `consultantId=${agentConfig.consultantId}&` +
                `startDate=${startDate.toISOString()}&` +
                `endDate=${endDate.toISOString()}&` +
                `agentConfigId=${agentConfig.id}`
              );
              
              if (slotsResponse.ok) {
                const slotsData = await slotsResponse.json();
                availableSlots = slotsData.slots || [];
                console.log(`   ✅ [PUBLIC-SLOTS] Fetched ${availableSlots.length} available slots from calendar`);
                
                // Step 3: Save slots to database for future context
                if (availableSlots.length > 0) {
                  const expiresAt = new Date();
                  expiresAt.setHours(expiresAt.getHours() + 48);
                  
                  // Check if slots already exist for this public conversation
                  const [existing] = await db
                    .select()
                    .from(schema.proposedAppointmentSlots)
                    .where(
                      and(
                        eq(schema.proposedAppointmentSlots.publicConversationId, conversation.id),
                        eq(schema.proposedAppointmentSlots.consultantId, agentConfig.consultantId)
                      )
                    )
                    .limit(1);
                  
                  if (existing) {
                    await db
                      .update(schema.proposedAppointmentSlots)
                      .set({
                        slots: availableSlots,
                        proposedAt: new Date(),
                        expiresAt,
                        usedForBooking: false,
                      })
                      .where(eq(schema.proposedAppointmentSlots.id, existing.id));
                    console.log(`   💾 [PUBLIC-SLOTS] Updated existing slots in database (expires in 48h)`);
                  } else {
                    await db
                      .insert(schema.proposedAppointmentSlots)
                      .values({
                        publicConversationId: conversation.id,
                        consultantId: agentConfig.consultantId,
                        slots: availableSlots,
                        proposedAt: new Date(),
                        expiresAt,
                        usedForBooking: false,
                      });
                    console.log(`   💾 [PUBLIC-SLOTS] Saved ${availableSlots.length} slots to database (expires in 48h)`);
                  }
                }
              } else {
                console.error(`   ⚠️ [PUBLIC-SLOTS] Failed to fetch slots: ${slotsResponse.status}`);
              }
            } catch (slotFetchError: any) {
              console.error(`   ⚠️ [PUBLIC-SLOTS] Error fetching slots: ${slotFetchError.message}`);
            }
          }
          
          // Get consultant timezone for context
          const [consultantSettings] = await db
            .select()
            .from(schema.consultantAvailabilitySettings)
            .where(eq(schema.consultantAvailabilitySettings.consultantId, agentConfig.consultantId))
            .limit(1);
          
          const timezone = consultantSettings?.timezone || 'Europe/Rome';
          
          if (availableSlots.length > 0) {
            bookingContextForAI = {
              availableSlots,
              timezone
            };
            console.log(`   ✅ [PUBLIC-SLOTS] Booking context prepared with ${availableSlots.length} slots for AI`);
          }
          
        } catch (slotError: any) {
          console.error(`   ⚠️ [PUBLIC-SLOTS] Error in slot fetching: ${slotError.message}`);
        }
      }
      // ═══════════════════════════════════════════════════════════════════════
      
      try {
        // ═══════════════════════════════════════════════════════════════════════
        // STREAMING AI - SOLO se nessuna azione booking è stata completata
        // ═══════════════════════════════════════════════════════════════════════
        if (!bookingActionCompleted) {
          // Stream AI response (using consultant chat service)
          console.log(`\n🤖 Starting AI response stream...`);
          let chunkCount = 0;
          let fullThinking = '';
          
          const tokenType = (req as any).tokenType as string | undefined;
          const goldMemoryCtx = tokenType === 'gold' && managerId ? {
            subscriptionId: managerId,
            agentConfigId: share.agentConfigId || undefined,
          } : undefined;
          
          if (goldMemoryCtx) {
            console.log(`🧠 [GOLD] Passing memory context for subscription ${managerId?.slice(0, 8)}...`);
          }
          
          for await (const event of agentService.processConsultantAgentMessage(
            conversation.consultantId,
            conversation.id,
            message,
            pendingModification,
            bookingContextForAI,
            managerPreferences,
            goldMemoryCtx,
            'public-chat',
            tokenType as 'bronze' | 'silver' | 'gold' | 'manager' | undefined,
            managerId || undefined
          )) {
            // Handle different event types from the generator
            if (event.type === 'promptBreakdown') {
              // Send prompt breakdown info to client (always, for debugging/analytics)
              res.write(`data: ${JSON.stringify({ type: 'promptBreakdown', data: event.data })}\n\n`);
              console.log(`📋 [PROMPT BREAKDOWN] Sent to client - ${event.data.systemPromptLength} chars, ${event.data.hasFileSearch ? 'File Search ACTIVE' : 'No File Search'}`);
            } else if (event.type === 'thinking') {
              // Accumulate thinking content and send to client
              fullThinking += event.content;
              res.write(`data: ${JSON.stringify({ type: 'thinking', content: event.content })}\n\n`);
            } else if (event.type === 'chunk') {
              fullResponse += event.content;
              chunkCount++;
              // Only emit text chunks if sendText is true (honor audioResponseMode)
              if (responseDecision.sendText) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: event.content })}\n\n`);
              }
            } else if (event.type === 'citations') {
              // Send citations info to client
              res.write(`data: ${JSON.stringify({ type: 'citations', data: event.data })}\n\n`);
              console.log(`📚 [CITATIONS] Sent ${event.data.length} File Search citations to client`);
            }
          }
          
          if (fullThinking) {
            console.log(`🧠 Thinking content captured: ${fullThinking.length} chars`);
          }
          
          console.log(`✅ AI response complete - ${chunkCount} chunks, ${fullResponse.length} chars`);
          
          if (responseDecision.sendAudio) {
            console.log('\n🎙️ Generating TTS audio response...');
            
            try {
              // Get AI provider for TTS
              const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
              const _ttsSlug = (agentConfig.agentName || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              aiProvider.setFeature?.(`public-chat:${_ttsSlug}`);
              
              if (!aiProvider.vertexClient) {
                console.warn('⚠️ [TTS] No VertexAI client available - falling back to text-only');
                responseDecision.sendAudio = false;
                responseDecision.sendText = true;
              } else {
                const ttsAudioBuffer = await generateSpeech({
                  text: fullResponse,
                  vertexClient: aiProvider.vertexClient,
                  projectId: aiProvider.metadata.projectId || process.env.VERTEX_PROJECT_ID || '',
                  location: aiProvider.metadata.location || process.env.VERTEX_LOCATION || 'us-central1'
                });
                
                // Ensure audio directory exists
                const audioDir = path.join(process.cwd(), 'uploads', 'audio');
                if (!fs.existsSync(audioDir)) {
                  fs.mkdirSync(audioDir, { recursive: true });
                  console.log(`✅ Created audio directory: ${audioDir}`);
                }
                
                // Save audio file
                const fileName = `agent-audio-${nanoid()}.wav`;
                const filePath = path.join(audioDir, fileName);
                fs.writeFileSync(filePath, ttsAudioBuffer);
                
                audioUrl = `/uploads/audio/${fileName}`;
                console.log(`✅ Audio saved: ${audioUrl}`);
                
                // Calculate audio duration
                agentAudioDuration = Math.round(await getAudioDurationInSeconds(filePath));
                console.log(`⏱️  Agent audio duration: ${agentAudioDuration} seconds`);
              }
            } catch (ttsError: any) {
              console.error('❌ [TTS] Error generating audio:', ttsError);
              // Fallback to text-only
              responseDecision.sendAudio = false;
              responseDecision.sendText = true;
            }
          } else {
            console.log('\nℹ️ TTS disabled or not needed for this response mode');
          }
          
          // If TTS fallback happened (was audio-only but became text), send the text now
          if (!originalSendText && responseDecision.sendText && fullResponse) {
            console.log(`\n📤 [FALLBACK] Sending text after TTS failure (was audio-only)...`);
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullResponse })}\n\n`);
          }

          // IMPORTANT: Always save full response text for AI context, regardless of audioResponseMode
          // The AI needs to see its complete conversation history to maintain context
          const messageContent = fullResponse;
          
          console.log(`\n💾 Saving agent response...`);
          await db.insert(schema.whatsappAgentConsultantMessages).values({
            conversationId: conversation.id,
            role: 'agent',
            content: messageContent,
            thinkingContent: fullThinking || null,
            messageType: audioUrl ? 'audio' : 'text',
            audioUrl: audioUrl,
            audioDuration: agentAudioDuration,
            voice: audioUrl ? ACHERNAR_VOICE : null,
          });
          
          const sentTypes = [];
          if (responseDecision.sendText && messageContent) sentTypes.push('text');
          if (responseDecision.sendAudio && audioUrl) sentTypes.push('audio');
          console.log(`✅ Agent message saved: ${sentTypes.join(' + ') || 'empty'}`);
          
          // ═══════════════════════════════════════════════════════════════════════
          // BOOKING AUTOMATICO - CREAZIONE NUOVI BOOKING (DOPO LO STREAMING AI)
          // Questo blocco gestisce SOLO la creazione di nuovi booking
          // Le modifiche/cancellazioni/aggiunta invitati sono gestite PRIMA dello streaming
          // ═══════════════════════════════════════════════════════════════════════
          if (agentConfig.bookingEnabled !== false) {
            try {
              console.log(`\n📅 [PUBLIC-BOOKING-POST] Checking for new booking creation...`);
              
              // Verifica se esiste già un booking confermato (se sì, salta - già gestito sopra)
              const [existingBookingPost] = await db
                .select()
                .from(schema.appointmentBookings)
                .where(
                  and(
                    eq(schema.appointmentBookings.publicConversationId, conversation.id),
                    eq(schema.appointmentBookings.status, 'confirmed')
                  )
                )
                .limit(1);
              
              if (!existingBookingPost) {
                // ══════════════════════════════════════════════════════════════════════
                // CHECK: Cerca booking cancellato recentemente per riutilizzare i dati
                // Solo booking cancellati nelle ultime 24 ore per evitare dati stantii
                // ══════════════════════════════════════════════════════════════════════
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const [recentlyCancelledBooking] = await db
                  .select()
                  .from(schema.appointmentBookings)
                  .where(
                    and(
                      eq(schema.appointmentBookings.publicConversationId, conversation.id),
                      eq(schema.appointmentBookings.status, 'cancelled'),
                      sql`${schema.appointmentBookings.updatedAt} > ${twentyFourHoursAgo.toISOString()}`
                    )
                  )
                  .orderBy(desc(schema.appointmentBookings.updatedAt))
                  .limit(1);
                
                if (recentlyCancelledBooking) {
                  console.log(`   📋 [CANCELLED BOOKING FOUND] Found recently cancelled booking (within 24h) with email: ${recentlyCancelledBooking.clientEmail}, phone: ${recentlyCancelledBooking.clientPhone}`);
                }
                
                // ACCUMULATOR PATTERN: Always proceed with extraction (no pre-check skip)
                const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
                const _bookSlug = (agentConfig.agentName || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                aiProvider.setFeature?.(`public-chat:${_bookSlug}`);
                console.log(`   ✅ [ACCUMULATOR] Always proceeding with new booking analysis (no pre-check skip)`);
                  
                // Recupera cronologia conversazione (ultimi 15 messaggi)
                  const recentMessages = await db
                    .select()
                    .from(schema.whatsappAgentConsultantMessages)
                    .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversation.id))
                    .orderBy(desc(schema.whatsappAgentConsultantMessages.createdAt))
                    .limit(15);
                  
                  // Converti in formato richiesto dal booking service
                  const conversationMessages: ConversationMessage[] = recentMessages
                    .reverse()
                    .map(m => ({
                      sender: m.role === 'user' ? 'client' as const : 'ai' as const,
                      messageText: m.content || ''
                    }));
                  
                  console.log(`   📚 Analyzing ${conversationMessages.length} messages for new booking...`);
                  
                  // Estrai dati booking dalla conversazione
                  // ACCUMULATOR PATTERN: Passa publicConversationId per accumulare dati progressivamente
                  const extracted = await extractBookingDataFromConversation(
                    conversationMessages,
                    undefined, // Nessun booking esistente
                    aiProvider.client,
                    'Europe/Rome',
                    undefined, // providerName
                    {
                      publicConversationId: conversation.id,
                      consultantId: agentConfig.consultantId,
                    }
                  );
                  
                  if (extracted && 'isConfirming' in extracted) {
                    const extractionResult = extracted as BookingExtractionResult;
                    console.log(`   📊 Extraction: hasAllData=${extractionResult.hasAllData}, isConfirming=${extractionResult.isConfirming}`);
                    console.log(`   📋 Data: date=${extractionResult.date}, time=${extractionResult.time}, email=${extractionResult.email}, phone=${extractionResult.phone}`);
                    
                    // ══════════════════════════════════════════════════════════════════════
                    // FILL MISSING DATA: Se mancano email/phone, usa i dati del booking cancellato
                    // ══════════════════════════════════════════════════════════════════════
                    if (recentlyCancelledBooking) {
                      if (!extractionResult.email && recentlyCancelledBooking.clientEmail) {
                        extractionResult.email = recentlyCancelledBooking.clientEmail;
                        console.log(`   🔄 [REUSE] Filled email from cancelled booking: ${extractionResult.email}`);
                      }
                      if (!extractionResult.phone && recentlyCancelledBooking.clientPhone) {
                        extractionResult.phone = recentlyCancelledBooking.clientPhone;
                        console.log(`   🔄 [REUSE] Filled phone from cancelled booking: ${extractionResult.phone}`);
                      }
                      if (!extractionResult.name && recentlyCancelledBooking.clientName) {
                        extractionResult.name = recentlyCancelledBooking.clientName;
                        console.log(`   🔄 [REUSE] Filled name from cancelled booking: ${extractionResult.name}`);
                      }
                      // Ricalcola hasAllData dopo aver riempito i dati mancanti
                      extractionResult.hasAllData = !!(extractionResult.date && extractionResult.time && extractionResult.phone && extractionResult.email);
                      console.log(`   📊 [AFTER REUSE] hasAllData=${extractionResult.hasAllData}`);
                    }
                    
                    // Per link pubblici: richiedi solo date, time, email (phone è opzionale)
                    const hasRequiredWebData = extractionResult.date && extractionResult.time && extractionResult.email;
                    
                    if (extractionResult.isConfirming && hasRequiredWebData) {
                      
                      // Valida i dati (phone is optional for public_link)
                      const validation = await validateBookingData(extractionResult, agentConfig.consultantId, 'Europe/Rome', 'public_link');
                      
                      if (validation.valid) {
                        console.log(`   ✅ Validation passed - creating booking...`);
                        
                        // Crea record booking con source e publicConversationId
                        const booking = await createBookingRecord(
                          agentConfig.consultantId,
                          null, // conversationId nullo per public links
                          {
                            date: extractionResult.date,
                            time: extractionResult.time,
                            phone: extractionResult.phone || '', // Will be normalized to null in createBookingRecord
                            email: extractionResult.email,
                            name: extractionResult.name || `Visitor ${visitorId.slice(0, 8)}`
                          },
                          'public_link',
                          conversation.id // publicConversationId
                        );
                        
                        if (booking) {
                          // ══════════════════════════════════════════════════════════════
                          // ROUND-ROBIN: Determina l'agente effettivo per il booking
                          // Stessa logica del WhatsApp message-processor
                          // ══════════════════════════════════════════════════════════════
                          let calendarResult: { googleEventId: string | null; googleMeetLink: string | null };
                          let rrResult: import("../../booking/round-robin-service").RoundRobinResult | null = null;

                          const resolved = await resolveRoundRobinAgent(
                            agentConfig.id, agentConfig.consultantId, extractionResult.date, extractionResult.time
                          );
                          rrResult = resolved.roundRobinResult;

                          if (rrResult?.isStandaloneMember) {
                            calendarResult = await createStandaloneCalendarBooking(
                              agentConfig.consultantId, booking, extractionResult.email, rrResult.memberId
                            );
                          } else {
                            calendarResult = await createGoogleCalendarBooking(
                              agentConfig.consultantId,
                              booking,
                              extractionResult.email,
                              resolved.effectiveAgentConfigId
                            );
                          }

                          // Registra assegnazione round-robin e aggiorna booking
                          if (rrResult) {
                            const { recordRoundRobinAssignment } = await import("../../booking/round-robin-service");
                            await recordRoundRobinAssignment(rrResult, booking.id);
                            await db.update(schema.appointmentBookings)
                              .set({ assignedAgentConfigId: rrResult.selectedAgentConfigId })
                              .where(eq(schema.appointmentBookings.id, booking.id));
                            console.log(`\n🔄 [PUBLIC-ROUND-ROBIN] Assegnato a membro: ${rrResult.selectedAgentConfigId}`);
                            console.log(`   ├── Pool member ID: ${rrResult.memberId}`);
                            console.log(`   ├── Motivo: ${rrResult.reason}`);
                            console.log(`   └── Standalone: ${rrResult.isStandaloneMember ? 'SÌ' : 'NO'}`);
                          }

                          // Aggiorna Google Event ID nel booking
                          await db.update(schema.appointmentBookings)
                            .set({ googleEventId: calendarResult.googleEventId })
                            .where(eq(schema.appointmentBookings.id, booking.id));
                          
                          console.log(`   🎉 [PUBLIC-BOOKING] Booking created successfully!`);
                          console.log(`   🆔 Booking ID: ${booking.id}`);
                          console.log(`   📅 Date: ${booking.appointmentDate} ${booking.appointmentTime}`);
                          console.log(`   📧 Email: ${extractionResult.email}`);
                          if (calendarResult.googleEventId) {
                            console.log(`   📆 Google Event: ${calendarResult.googleEventId}`);
                          }
                          if (calendarResult.googleMeetLink) {
                            console.log(`   🎥 Meet Link: ${calendarResult.googleMeetLink}`);
                          }
                          if (rrResult) {
                            console.log(`   🔄 Round-Robin: ✅ Assegnato a ${rrResult.selectedAgentConfigId}`);
                          }
                          
                          // Notifica: al membro assegnato (round-robin) o all'agente originale
                          // Per standalone members, selectedAgentConfigId è il memberId (non un agentConfigId valido)
                          // quindi usiamo fallback all'agente originale del link
                          const effectiveNotifAgentId = (rrResult && !rrResult.isStandaloneMember)
                            ? rrResult.selectedAgentConfigId
                            : agentConfig.id;
                          try {
                            const notificationFormattedDate = formatAppointmentDate(extractionResult.date, extractionResult.time);
                            const notifResult = await sendBookingNotification(effectiveNotifAgentId, {
                              clientName: extractionResult.name || `Visitor ${visitorId.slice(0, 8)}`,
                              date: notificationFormattedDate,
                              time: extractionResult.time,
                              meetLink: calendarResult.googleMeetLink,
                            });
                            if (notifResult.success) {
                              console.log(`   📱 [BOOKING NOTIFICATION] ✅ Sent successfully to ${effectiveNotifAgentId}`);
                            } else {
                              console.log(`   ⚠️ [BOOKING NOTIFICATION] Not sent: ${notifResult.error || 'Unknown reason'}`);
                            }
                          } catch (notifError: any) {
                            console.log(`   ❌ [BOOKING NOTIFICATION] Error: ${notifError?.message || notifError}`);
                          }
                          
                          // Invia email di conferma al cliente
                          const emailResult = await sendBookingConfirmationEmail(
                            agentConfig.consultantId,
                            booking,
                            calendarResult.googleMeetLink
                          );
                          if (emailResult.success) {
                            console.log(`   📧 Confirmation email sent!`);
                          } else {
                            console.log(`   ⚠️ Email not sent: ${emailResult.errorMessage || 'SMTP not configured'}`);
                          }
                          
                          // ══════════════════════════════════════════════════════════════════════
                          // MESSAGGIO DI CONFERMA NELLA CHAT (come WhatsApp)
                          // ══════════════════════════════════════════════════════════════════════
                          const formattedDate = booking.appointmentDate!.split('-').reverse().join('/');
                          const bookingConfirmationMessage = calendarResult.googleMeetLink 
                            ? `🎉 APPUNTAMENTO CONFERMATO!

📅 Data: ${formattedDate}
🕐 Orario: ${booking.appointmentTime}
⏱️ Durata: 60 minuti

🎥 Link Google Meet: ${calendarResult.googleMeetLink}

📧 Ti ho inviato l'invito calendario a ${extractionResult.email}

Ti consiglio di collegarti 2-3 minuti prima! 📱`
                            : `🎉 APPUNTAMENTO CONFERMATO!

📅 Data: ${formattedDate}
🕐 Orario: ${booking.appointmentTime}
⏱️ Durata: 60 minuti

📧 Ti ho inviato l'invito calendario a ${extractionResult.email}

Ti aspettiamo! 🚀`;
                          
                          // Salva messaggio nel database
                          await db.insert(schema.whatsappAgentConsultantMessages).values({
                            conversationId: conversation.id,
                            role: 'agent',
                            content: bookingConfirmationMessage,
                            messageType: 'text',
                          });
                          
                          // Invia via SSE al client
                          res.write(`data: ${JSON.stringify({ type: 'chunk', content: bookingConfirmationMessage })}\n\n`);
                          
                          console.log(`   ✅ [PUBLIC-BOOKING] Confirmation message sent to chat!`);
                          
                          bookingResult = {
                            created: true,
                            modified: false,
                            cancelled: false,
                            attendeesAdded: false,
                            booking: booking,
                            googleMeetLink: calendarResult.googleMeetLink || undefined,
                            confirmationMessage: bookingConfirmationMessage
                          };
                          
                          // ACCUMULATOR: Mark extraction state as completed
                          await markExtractionStateCompleted(null, conversation.id);
                        }
                      } else {
                        console.log(`   ❌ Validation failed: ${validation.reason}`);
                      }
                    } else {
                      console.log(`   ℹ️ Not all data available or user not confirming yet`);
                    }
                  } else {
                    console.log(`   ℹ️ No booking data extracted from conversation`);
                  }
              } else {
                console.log(`   ℹ️ Booking already exists - skipping new booking creation (modifications handled pre-streaming)`);
              }
            } catch (bookingError: any) {
              console.error(`   ❌ [PUBLIC-BOOKING-POST] Error: ${bookingError.message}`);
              // Non bloccare la risposta - il booking è un'operazione secondaria
            }
          } else {
            console.log(`\n📅 [PUBLIC-BOOKING] Booking disabled for this agent`);
          }
        } else {
          console.log(`\n⏭️ [AI STREAMING] Skipped - booking action was completed`);
        }
        // ═══════════════════════════════════════════════════════════════════════
        
        // Track message sent
        await shareService.trackMessage(share.id);
        
        // Update conversation last message time
        await db
          .update(schema.whatsappAgentConsultantConversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(schema.whatsappAgentConsultantConversations.id, conversation.id));
        
        // ═══════════════════════════════════════════════════════════════════════
        // TITLE GENERATION - Generate title after first exchange using Gemini Flash Lite
        // ═══════════════════════════════════════════════════════════════════════
        try {
          // Count messages in conversation
          const [messageCountResult] = await db
            .select({ count: sql<number>`count(*)` })
            .from(schema.whatsappAgentConsultantMessages)
            .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversation.id));
          
          const messageCount = Number(messageCountResult?.count) || 0;
          console.log(`📊 [TITLE-GEN] Conversation ${conversation.id}: ${messageCount} messages, current title: "${conversation.title}"`);
          
          // Generate title after exactly 2 messages (first user + first AI response)
          // Check for null, undefined, empty string, or default title
          const needsTitleGeneration = !conversation.title || 
            conversation.title === 'Nuova conversazione' || 
            conversation.title === 'null' ||
            conversation.title.trim() === '';
          
          if (messageCount === 2 && needsTitleGeneration) {
            console.log(`\n📝 [TITLE-GEN] Generating title for conversation ${conversation.id}...`);
            
            // Get first user message and first AI response
            const firstMessages = await db
              .select()
              .from(schema.whatsappAgentConsultantMessages)
              .where(eq(schema.whatsappAgentConsultantMessages.conversationId, conversation.id))
              .orderBy(schema.whatsappAgentConsultantMessages.createdAt)
              .limit(2);
            
            const firstUserMessage = firstMessages.find(m => m.role === 'user');
            const firstAIResponse = firstMessages.find(m => m.role === 'assistant');
            
            console.log(`   📨 User message: "${firstUserMessage?.content?.substring(0, 100) || 'N/A'}..."`);
            console.log(`   🤖 AI response: "${firstAIResponse?.content?.substring(0, 100) || 'N/A'}..."`);
            
            if (firstUserMessage?.content) {
              // Get API key: first try SuperAdmin keys, then fallback to env
              let geminiApiKey: string | null = null;
              
              const superAdminKeys = await getSuperAdminGeminiKeys();
              if (superAdminKeys && superAdminKeys.enabled && superAdminKeys.keys.length > 0) {
                geminiApiKey = superAdminKeys.keys[0];
                console.log(`   🔑 [TITLE-GEN] Using SuperAdmin Gemini key`);
              } else if (process.env.GEMINI_API_KEY) {
                geminiApiKey = process.env.GEMINI_API_KEY;
                console.log(`   🔑 [TITLE-GEN] Using GEMINI_API_KEY from environment`);
              }
              
              if (geminiApiKey) {
                // Use Gemini Flash Lite for title generation (fast and cheap)
                const { GoogleGenAI } = await import('@google/genai');
                const genai = new GoogleGenAI({ apiKey: geminiApiKey });
                
                // Include both user message and AI response for better context
                const aiResponseSnippet = firstAIResponse?.content?.substring(0, 300) || '';
                const titlePrompt = `Genera un titolo breve e descrittivo (3-6 parole) per questa conversazione. Il titolo deve descrivere L'ARGOMENTO PRINCIPALE della discussione, non ripetere la domanda dell'utente.

Rispondi SOLO con il titolo, senza virgolette o punteggiatura finale.

Domanda utente: "${firstUserMessage.content.substring(0, 200)}"
${aiResponseSnippet ? `Risposta AI: "${aiResponseSnippet}"` : ''}

Esempi di buoni titoli:
- "Informazioni sui servizi"
- "Richiesta appuntamento"
- "Consulenza finanziaria"
- "Domande sul piano Gold"
- "Supporto tecnico account"

Titolo:`;

                console.log(`   🤖 [TITLE-GEN] Calling Gemini API...`);
                const result = await trackedGenerateContent(genai, {
                  model: 'gemini-3.1-flash-lite-preview',
                  contents: titlePrompt,
                } as any, { consultantId: agentConfig.consultantId, feature: 'whatsapp-agent' });
                
                const generatedTitle = result.text?.trim().replace(/^["']|["']$/g, '').substring(0, 50) || 'Conversazione';
                
                // Update conversation title
                await db
                  .update(schema.whatsappAgentConsultantConversations)
                  .set({ title: generatedTitle })
                  .where(eq(schema.whatsappAgentConsultantConversations.id, conversation.id));
                
                console.log(`   ✅ [TITLE-GEN] Title generated and saved: "${generatedTitle}"`);
                
                // Send title update via SSE
                res.write(`data: ${JSON.stringify({ type: 'titleUpdate', title: generatedTitle, conversationId: conversation.id })}\n\n`);
                console.log(`   📤 [TITLE-GEN] Sent titleUpdate SSE event to client`);
              } else {
                console.log(`   ⚠️ [TITLE-GEN] No Gemini API key available, skipping title generation`);
              }
            } else {
              console.log(`   ⚠️ [TITLE-GEN] No first user message found`);
            }
          } else if (messageCount !== 2) {
            console.log(`   ℹ️ [TITLE-GEN] Skipping - messageCount is ${messageCount}, not 2`);
          } else {
            console.log(`   ℹ️ [TITLE-GEN] Skipping - title already set to "${conversation.title}"`);
          }
        } catch (titleError: any) {
          console.error(`   ⚠️ [TITLE-GEN] Error generating title:`, titleError.message);
          // Non-critical error, don't fail the request
        }
        // ═══════════════════════════════════════════════════════════════════════
        
        // Send completion signal with audio metadata, booking info, Bronze usage info, and conversation ID
        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          conversationId: conversation.id,
          audioUrl: audioUrl || undefined,
          audioDuration: agentAudioDuration || undefined,
          bookingCreated: bookingResult.created || undefined,
          bookingId: bookingResult.booking?.id || undefined,
          googleMeetLink: bookingResult.googleMeetLink || undefined,
          ...(bronzeUsageInfo ? {
            dailyMessagesUsed: bronzeUsageInfo.dailyMessagesUsed,
            dailyMessageLimit: bronzeUsageInfo.dailyMessageLimit,
            remaining: bronzeUsageInfo.remaining,
          } : {}),
        })}\n\n`);
        res.end();
        
        console.log(`✅ [SUCCESS] Public share message processed successfully`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
      } catch (streamError: any) {
        console.error(`\n❌ [STREAMING ERROR]:`, streamError);
        
        const errorMessage = streamError.message.includes('API key') 
          ? 'Errore configurazione AI. Verifica le impostazioni API.'
          : streamError.message.includes('quota')
          ? 'Quota AI esaurita. Contatta il supporto.'
          : `Errore AI: ${streamError.message}`;
        
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
        res.end();
      }
      
    } catch (error: any) {
      console.error(`\n❌ [ERROR] Error processing public share message:`, error);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Errore durante l\'elaborazione del messaggio' });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    }
  }
);

/**
 * POST /public/whatsapp/shares/:slug/send-audio
 * Send audio message to shared agent (audio upload + transcription + TTS response)
 */
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post(
  '/:slug/send-audio',
  validateShareExists,
  validateDomainAccess,
  validateVisitorSession,
  audioUpload.single('audio'),
  async (req: Request & { share?: schema.WhatsappAgentShare }, res) => {
    const share = req.share!;
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎤 [PUBLIC-SHARE-AUDIO] Voice message upload from visitor');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      const audioBuffer = req.file.buffer;
      
      // Get visitorId from query (validated by middleware)
      const visitorId = req.query.visitorId as string;
      
      if (!visitorId) {
        return res.status(400).json({ error: 'visitorId required' });
      }
      
      console.log(`📝 Audio size: ${audioBuffer.length} bytes (~${(audioBuffer.length / 1024).toFixed(2)} KB)`);
      console.log(`🔗 Share: ${share.slug} (${share.agentName})`);
      console.log(`👤 Visitor: ${visitorId}`);
      
      // 1. Get agent configuration
      console.log('\n📥 [STEP 1] Fetching agent configuration...');
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, share.agentConfigId))
        .limit(1);
      
      if (!agentConfig) {
        console.error('❌ Agent configuration not found');
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      console.log(`✅ Agent: ${agentConfig.agentName} (TTS: ${agentConfig.ttsEnabled})`);
      
      // 2. Get or create conversation
      console.log('\n📥 [STEP 2] Fetching or creating conversation...');
      let [conversation] = await db
        .select()
        .from(schema.whatsappAgentConsultantConversations)
        .where(
          and(
            eq(schema.whatsappAgentConsultantConversations.agentConfigId, share.agentConfigId),
            eq(schema.whatsappAgentConsultantConversations.shareId, share.id),
            eq(schema.whatsappAgentConsultantConversations.externalVisitorId, visitorId)
          )
        )
        .limit(1);
      
      if (!conversation) {
        console.log(`📝 Creating new conversation...`);
        [conversation] = await db
          .insert(schema.whatsappAgentConsultantConversations)
          .values({
            consultantId: agentConfig.consultantId,
            agentConfigId: share.agentConfigId,
            shareId: share.id,
            externalVisitorId: visitorId,
            phoneNumber: null,
            customerName: `Visitor ${visitorId.slice(0, 8)}`,
            conversationStatus: 'active',
            lastMessageAt: new Date(),
            visitorMetadata: {
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              referrer: req.get('referer'),
              firstAccessAt: new Date().toISOString(),
            },
          })
          .returning();
        console.log(`✅ Conversation created: ${conversation.id}`);
      } else {
        console.log(`✅ Existing conversation: ${conversation.id}`);
      }
      
      // 3. Get AI provider (Vertex AI)
      console.log('\n🔌 [STEP 3] Getting Vertex AI provider...');
      const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
      const _audioSlug = (agentConfig.agentName || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      aiProvider.setFeature?.(`public-chat:${_audioSlug}`);
      console.log(`✅ Provider: ${aiProvider.source}`);
      
      // 4. Transcribe audio with Vertex AI
      console.log('\n🎧 [STEP 4] Transcribing audio...');
      const model = aiProvider.client.generateContent ? 
        { generateContent: aiProvider.client.generateContent.bind(aiProvider.client) } : 
        aiProvider.client;
      
      const { model: modelName, useThinking, thinkingLevel } = getModelWithThinking(aiProvider.metadata.name);
      console.log(`[AI] Using model: ${modelName} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);
      
      const transcriptionResult = await model.generateContent({
        model: modelName,
        contents: [{
          role: 'user',
          parts: [
            { text: 'Trascrivi fedelmente questo audio in italiano:' },
            {
              inlineData: {
                data: audioBuffer.toString('base64'),
                mimeType: req.file.mimetype || 'audio/webm'
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
          ...(useThinking && { thinkingConfig: { thinkingLevel } }),
        },
      });
      
      const transcription = transcriptionResult.response.text();
      console.log(`✅ Transcription (${transcription.length} chars): "${transcription.substring(0, 100)}..."`);
      
      // 5. Save visitor audio file
      console.log('\n💾 [STEP 5] Saving visitor audio...');
      const visitorAudioDir = path.join(process.cwd(), 'uploads', 'audio');
      if (!fs.existsSync(visitorAudioDir)) {
        fs.mkdirSync(visitorAudioDir, { recursive: true });
        console.log(`✅ Created audio directory: ${visitorAudioDir}`);
      }
      
      const visitorFileName = `visitor-audio-${nanoid()}.webm`;
      const visitorFilePath = path.join(visitorAudioDir, visitorFileName);
      fs.writeFileSync(visitorFilePath, audioBuffer);
      const visitorAudioUrl = `/uploads/audio/${visitorFileName}`;
      console.log(`✅ Visitor audio saved: ${visitorAudioUrl}`);
      
      // Calculate audio duration with fallback for webm files without metadata
      let visitorAudioDuration: number;
      try {
        visitorAudioDuration = Math.round(await getAudioDurationInSeconds(visitorFilePath));
        console.log(`⏱️  Visitor audio duration: ${visitorAudioDuration} seconds (from metadata)`);
      } catch (durationError: any) {
        // Fallback: estimate duration from file size
        const stats = fs.statSync(visitorFilePath);
        const fileSizeKB = stats.size / 1024;
        visitorAudioDuration = Math.max(1, Math.ceil(fileSizeKB / 16));
        console.warn(`⚠️  Could not read duration from metadata: ${durationError.message}`);
        console.log(`📊 Estimated duration from file size: ${visitorAudioDuration}s (${fileSizeKB.toFixed(2)} KB)`);
      }
      
      // 6. Save visitor message with transcription, audio URL and duration
      console.log('\n💾 [STEP 6] Saving visitor message...');
      await db.insert(schema.whatsappAgentConsultantMessages).values({
        conversationId: conversation.id,
        role: 'user',
        content: transcription,
        messageType: 'audio',
        transcription: transcription,
        audioUrl: visitorAudioUrl,
        audioDuration: visitorAudioDuration,
      });
      console.log('✅ Visitor message saved');
      
      // 7. Generate agent response (streaming)
      console.log('\n🤖 [STEP 7] Generating agent response...');
      let fullResponse = '';
      let chunkCount = 0;
      
      const voiceTokenType = (req as any).tokenType as 'bronze' | 'silver' | 'gold' | 'manager' | undefined;
      const voiceManagerId = (req as any).managerId as string | undefined;
      for await (const chunk of agentService.processConsultantAgentMessage(
        agentConfig.consultantId,
        conversation.id,
        transcription,
        undefined,
        undefined,
        undefined,
        undefined,
        'public-chat',
        voiceTokenType,
        voiceManagerId
      )) {
        fullResponse += chunk;
        chunkCount++;
      }
      
      console.log(`✅ Agent response generated (${chunkCount} chunks, ${fullResponse.length} chars)`);
      
      // 8. Determine if we should send audio and/or text based on audioResponseMode
      // Client sent audio, so clientSentAudio = true for mirror mode
      const responseDecision = agentConfig.ttsEnabled 
        ? shouldRespondWithAudio(agentConfig.audioResponseMode || 'always_text', true)
        : { sendAudio: false, sendText: true };
      
      // Track original decision for fallback detection
      const originalSendText = responseDecision.sendText;
      
      console.log(`🎛️ [AUDIO DECISION] Mode: ${agentConfig.audioResponseMode}, ClientSentAudio → sendAudio=${responseDecision.sendAudio}, sendText=${responseDecision.sendText}`);
      
      let audioUrl = null;
      let agentAudioDuration = null;
      
      if (responseDecision.sendAudio) {
        console.log('\n🎙️ [STEP 8] Generating TTS audio with Achernar voice...');
        
        if (!aiProvider.vertexClient) {
          console.warn('⚠️ [TTS] No VertexAI client available - falling back to text-only');
          responseDecision.sendAudio = false;
          responseDecision.sendText = true;
        } else {
          try {
            const ttsAudioBuffer = await generateSpeech({
              text: fullResponse,
              vertexClient: aiProvider.vertexClient,
              projectId: aiProvider.metadata.projectId || process.env.VERTEX_PROJECT_ID || '',
              location: aiProvider.metadata.location || process.env.VERTEX_LOCATION || 'us-central1'
            });
            
            // Ensure audio directory exists
            const audioDir = path.join(process.cwd(), 'uploads', 'audio');
            if (!fs.existsSync(audioDir)) {
              fs.mkdirSync(audioDir, { recursive: true });
              console.log(`✅ Created audio directory: ${audioDir}`);
            }
            
            // Save audio file
            const fileName = `agent-audio-${nanoid()}.wav`;
            const filePath = path.join(audioDir, fileName);
            fs.writeFileSync(filePath, ttsAudioBuffer);
            
            audioUrl = `/uploads/audio/${fileName}`;
            console.log(`✅ Audio saved: ${audioUrl}`);
            
            // Calculate audio duration
            agentAudioDuration = Math.round(await getAudioDurationInSeconds(filePath));
            console.log(`⏱️  Agent audio duration: ${agentAudioDuration} seconds`);
          } catch (ttsError: any) {
            console.error('❌ [TTS] Error generating audio:', ttsError);
            // Fallback to text-only
            responseDecision.sendAudio = false;
            responseDecision.sendText = true;
          }
        }
      } else {
        console.log('\nℹ️ [STEP 8] TTS disabled for this agent - skipping audio generation');
      }
      
      // IMPORTANT: Always save full response text for AI context, regardless of audioResponseMode
      // The AI needs to see its complete conversation history to maintain context
      const messageContent = fullResponse;
      
      console.log('\n💾 [STEP 9] Saving agent message...');
      await db.insert(schema.whatsappAgentConsultantMessages).values({
        conversationId: conversation.id,
        role: 'agent',
        content: messageContent,
        messageType: audioUrl ? 'audio' : 'text',
        audioUrl: audioUrl,
        audioDuration: agentAudioDuration,
      });
      
      const sentTypes = [];
      if (responseDecision.sendText && messageContent) sentTypes.push('text');
      if (responseDecision.sendAudio && audioUrl) sentTypes.push('audio');
      console.log(`✅ Agent message saved: ${sentTypes.join(' + ') || 'empty'}`);
      
      // 10. Track access and message
      await shareService.trackAccess(share.id);
      await shareService.trackMessage(share.id);
      
      // Update conversation last message time
      await db
        .update(schema.whatsappAgentConsultantConversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(schema.whatsappAgentConsultantConversations.id, conversation.id));
      
      console.log('\n🎉 [SUCCESS] Voice message processed successfully');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // Return response (include text if sendText=true or if fallback happened)
      res.json({
        success: true,
        transcription,
        response: responseDecision.sendText ? fullResponse : undefined,
        audioUrl,
        audioDuration: agentAudioDuration || undefined
      });
      
      // Cleanup if needed
      if (aiProvider.cleanup) {
        await aiProvider.cleanup();
      }
      
    } catch (error: any) {
      console.error('\n❌ [ERROR] Failed to process voice message');
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      res.status(500).json({ error: `Failed to process audio: ${error.message}` });
    }
  }
);

export default router;
