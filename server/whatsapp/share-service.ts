/**
 * WhatsApp Agent Share Service
 * Handles CRUD operations and access validation for public agent sharing
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

/**
 * Generate a unique slug for a share
 * Format: agentname-random (e.g., "demo-monitor-abc123")
 */
export async function generateUniqueSlug(agentName: string): Promise<string> {
  // Sanitize agent name for URL
  const sanitized = agentName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20);
  
  // Try to generate a unique slug (max 5 attempts)
  for (let i = 0; i < 5; i++) {
    const randomPart = nanoid(8);
    const slug = `${sanitized}-${randomPart}`;
    
    // Check if slug already exists
    const existing = await db
      .select()
      .from(schema.whatsappAgentShares)
      .where(eq(schema.whatsappAgentShares.slug, slug))
      .limit(1);
    
    if (existing.length === 0) {
      return slug;
    }
  }
  
  // Fallback: use only random string
  return `share-${nanoid(12)}`;
}

/**
 * Create a new agent share
 */
export async function createShare(params: {
  consultantId: string;
  agentConfigId: string;
  agentName: string;
  accessType: 'public' | 'password' | 'token';
  password?: string;
  allowedDomains?: string[];
  expireAt?: Date;
  createdBy: string;
  requiresLogin?: boolean;
}) {
  const { consultantId, agentConfigId, agentName, accessType, password, allowedDomains, expireAt, createdBy, requiresLogin } = params;
  
  const MAX_SHARES_PER_AGENT = 2;
  
  // Check if max shares limit is reached for this agent
  const existing = await db
    .select()
    .from(schema.whatsappAgentShares)
    .where(
      and(
        eq(schema.whatsappAgentShares.agentConfigId, agentConfigId),
        sql`${schema.whatsappAgentShares.revokedAt} IS NULL`
      )
    );
  
  if (existing.length >= MAX_SHARES_PER_AGENT) {
    throw new Error(`Limite di ${MAX_SHARES_PER_AGENT} link raggiunto. Elimina un link esistente per crearne uno nuovo.`);
  }
  
  // Generate unique slug
  const slug = await generateUniqueSlug(agentName);
  
  // Hash password if provided
  let passwordHash: string | null = null;
  if (accessType === 'password') {
    if (!password) {
      throw new Error('Password richiesta per accessType "password"');
    }
    passwordHash = await bcrypt.hash(password, 10);
  }
  
  // Create share
  const [share] = await db
    .insert(schema.whatsappAgentShares)
    .values({
      consultantId,
      agentConfigId,
      slug,
      accessType,
      passwordHash,
      allowedDomains: allowedDomains || [],
      expireAt: expireAt || null,
      createdBy,
      isActive: true,
      requiresLogin: requiresLogin || false,
    })
    .returning();
  
  return share;
}

/**
 * Get share by slug
 */
export async function getShareBySlug(slug: string) {
  const [share] = await db
    .select()
    .from(schema.whatsappAgentShares)
    .where(eq(schema.whatsappAgentShares.slug, slug))
    .limit(1);
  
  return share || null;
}

/**
 * Get share by ID
 */
export async function getShareById(shareId: string) {
  const [share] = await db
    .select()
    .from(schema.whatsappAgentShares)
    .where(eq(schema.whatsappAgentShares.id, shareId))
    .limit(1);
  
  return share || null;
}

/**
 * Get all shares for a consultant
 */
export async function getSharesByConsultant(consultantId: string) {
  const shares = await db
    .select({
      share: schema.whatsappAgentShares,
      agent: schema.consultantWhatsappConfig,
    })
    .from(schema.whatsappAgentShares)
    .leftJoin(
      schema.consultantWhatsappConfig,
      eq(schema.whatsappAgentShares.agentConfigId, schema.consultantWhatsappConfig.id)
    )
    .where(eq(schema.whatsappAgentShares.consultantId, consultantId))
    .orderBy(desc(schema.whatsappAgentShares.createdAt));
  
  return shares;
}

/**
 * Validate share by ID (basic validation only: active, not expired, not revoked)
 * Used by middleware to check basic accessibility
 */
export async function validateShareById(shareId: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const share = await getShareById(shareId);
  
  if (!share) {
    return { valid: false, reason: 'Share non trovato' };
  }
  
  // Check if active
  if (!share.isActive) {
    return { valid: false, reason: 'Share disabilitato' };
  }
  
  // Check if revoked
  if (share.revokedAt) {
    return { valid: false, reason: 'Share revocato' };
  }
  
  // Check expiration
  if (share.expireAt && new Date(share.expireAt) < new Date()) {
    return { valid: false, reason: 'Share scaduto' };
  }
  
  return { valid: true };
}

/**
 * Validate share access
 * Returns validation result with share data if valid
 */
export async function validateShareAccess(params: {
  slug: string;
  password?: string;
  domain?: string;
}): Promise<{
  isValid: boolean;
  share?: schema.WhatsappAgentShare;
  reason?: string;
}> {
  const { slug, password, domain } = params;
  
  // Get share
  const share = await getShareBySlug(slug);
  
  if (!share) {
    return { isValid: false, reason: 'Share non trovato' };
  }
  
  // Check if active
  if (!share.isActive) {
    return { isValid: false, reason: 'Share disabilitato', share };
  }
  
  // Check expiration
  if (share.expireAt && new Date(share.expireAt) < new Date()) {
    return { isValid: false, reason: 'Share scaduto', share };
  }
  
  // Check password if required
  if (share.accessType === 'password') {
    if (!password) {
      return { isValid: false, reason: 'Password richiesta', share };
    }
    
    if (!share.passwordHash) {
      return { isValid: false, reason: 'Configurazione password non valida', share };
    }
    
    const passwordValid = await bcrypt.compare(password, share.passwordHash);
    if (!passwordValid) {
      return { isValid: false, reason: 'Password errata', share };
    }
  }
  
  // Check domain whitelist (only for iframe embeds)
  if (domain && share.allowedDomains && share.allowedDomains.length > 0) {
    const domainAllowed = share.allowedDomains.some(allowed => {
      // Exact match or subdomain match
      return domain === allowed || domain.endsWith(`.${allowed}`);
    });
    
    if (!domainAllowed) {
      return { isValid: false, reason: 'Dominio non autorizzato', share };
    }
  }
  
  return { isValid: true, share };
}

/**
 * Track share access (update analytics)
 */
export async function trackAccess(shareId: string, visitorId?: string) {
  // Atomic update: increment access count and update timestamp
  await db.execute(
    sql`
      UPDATE whatsapp_agent_shares 
      SET 
        total_access_count = total_access_count + 1,
        last_access_at = NOW()
      WHERE id = ${shareId}
    `
  );
  
  // TODO: Track unique visitors properly with a separate visitor tracking table
  // For now, unique_visitors_count is manually updated when needed
}

/**
 * Track message sent through share
 */
export async function trackMessage(shareId: string) {
  // Atomic increment of message counter
  await db.execute(
    sql`
      UPDATE whatsapp_agent_shares 
      SET total_messages_count = total_messages_count + 1
      WHERE id = ${shareId}
    `
  );
}

/**
 * Update share configuration
 */
export async function updateShare(
  shareId: string,
  consultantId: string,
  updates: {
    accessType?: 'public' | 'password' | 'token';
    password?: string;
    allowedDomains?: string[];
    expireAt?: Date | null;
    isActive?: boolean;
    rateLimitConfig?: {
      maxMessagesPerHour?: number;
      maxMessagesPerDay?: number;
      maxConversationsPerVisitor?: number;
    };
  }
) {
  // Verify ownership
  const share = await getShareById(shareId);
  if (!share) {
    throw new Error('Share non trovato');
  }
  
  if (share.consultantId !== consultantId) {
    throw new Error('Non autorizzato a modificare questo share');
  }
  
  // Prepare update data
  const updateData: Partial<schema.WhatsappAgentShare> = {
    updatedAt: new Date(),
  };
  
  if (updates.accessType !== undefined) {
    updateData.accessType = updates.accessType;
  }
  
  if (updates.password !== undefined) {
    updateData.passwordHash = await bcrypt.hash(updates.password, 10);
  }
  
  if (updates.allowedDomains !== undefined) {
    updateData.allowedDomains = updates.allowedDomains;
  }
  
  if (updates.expireAt !== undefined) {
    updateData.expireAt = updates.expireAt;
  }
  
  if (updates.isActive !== undefined) {
    updateData.isActive = updates.isActive;
  }
  
  if (updates.rateLimitConfig !== undefined) {
    updateData.rateLimitConfig = updates.rateLimitConfig;
  }
  
  // Update share
  const [updatedShare] = await db
    .update(schema.whatsappAgentShares)
    .set(updateData)
    .where(eq(schema.whatsappAgentShares.id, shareId))
    .returning();
  
  return updatedShare;
}

/**
 * Revoke a share (soft delete)
 */
export async function revokeShare(shareId: string, consultantId: string, reason?: string) {
  // Verify ownership
  const share = await getShareById(shareId);
  if (!share) {
    throw new Error('Share non trovato');
  }
  
  if (share.consultantId !== consultantId) {
    throw new Error('Non autorizzato a revocare questo share');
  }
  
  // Revoke share
  const [revokedShare] = await db
    .update(schema.whatsappAgentShares)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokeReason: reason || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.whatsappAgentShares.id, shareId))
    .returning();
  
  return revokedShare;
}

/**
 * Delete a share permanently
 */
export async function deleteShare(shareId: string, consultantId: string) {
  // Verify ownership
  const share = await getShareById(shareId);
  if (!share) {
    throw new Error('Share non trovato');
  }
  
  if (share.consultantId !== consultantId) {
    throw new Error('Non autorizzato a eliminare questo share');
  }
  
  // Delete share
  await db
    .delete(schema.whatsappAgentShares)
    .where(eq(schema.whatsappAgentShares.id, shareId));
  
  return { success: true };
}

/**
 * Get share analytics
 */
export async function getShareAnalytics(shareId: string, consultantId: string) {
  // Verify ownership
  const share = await getShareById(shareId);
  if (!share) {
    throw new Error('Share non trovato');
  }
  
  if (share.consultantId !== consultantId) {
    throw new Error('Non autorizzato a visualizzare le analytics di questo share');
  }
  
  // Get conversations created through this share
  const conversations = await db
    .select()
    .from(schema.whatsappAgentConsultantConversations)
    .where(eq(schema.whatsappAgentConsultantConversations.shareId, shareId))
    .orderBy(desc(schema.whatsappAgentConsultantConversations.createdAt));
  
  return {
    share,
    conversationsCount: conversations.length,
    conversations: conversations.slice(0, 10), // Last 10 conversations
  };
}

/**
 * Create visitor session after password validation
 */
export async function createVisitorSession(
  shareId: string, 
  visitorId: string,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  }
) {
  // Session expires in 24 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  // Upsert session (update if exists, insert if not)
  const [session] = await db
    .insert(schema.whatsappAgentShareVisitorSessions)
    .values({
      shareId,
      visitorId,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      referrer: metadata?.referrer,
    })
    .onConflictDoUpdate({
      target: [
        schema.whatsappAgentShareVisitorSessions.shareId, 
        schema.whatsappAgentShareVisitorSessions.visitorId
      ],
      set: {
        passwordValidatedAt: new Date(),
        expiresAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  
  return session;
}

/**
 * Verify visitor session is valid (authenticated and not expired)
 */
export async function verifyVisitorSession(shareId: string, visitorId: string): Promise<boolean> {
  const [session] = await db
    .select()
    .from(schema.whatsappAgentShareVisitorSessions)
    .where(
      and(
        eq(schema.whatsappAgentShareVisitorSessions.shareId, shareId),
        eq(schema.whatsappAgentShareVisitorSessions.visitorId, visitorId)
      )
    )
    .limit(1);
  
  if (!session) {
    return false;
  }
  
  // Check if session expired
  if (new Date() > new Date(session.expiresAt)) {
    // Clean up expired session
    await db
      .delete(schema.whatsappAgentShareVisitorSessions)
      .where(eq(schema.whatsappAgentShareVisitorSessions.id, session.id));
    return false;
  }
  
  return true;
}

/**
 * Validate domain from Origin or Referer header
 */
export function extractDomain(originOrReferer: string | undefined): string | null {
  if (!originOrReferer) return null;
  
  try {
    const url = new URL(originOrReferer);
    return url.hostname;
  } catch {
    return null;
  }
}
