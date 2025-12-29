/**
 * Instagram OAuth Router
 * 
 * Handles Facebook Login OAuth flow for Instagram Business account connection.
 * Uses centralized Super Admin credentials (metaAppId, metaAppSecret) from superadminInstagramConfig.
 */

import { Router, Response, Request } from "express";
import { authenticateToken, type AuthRequest } from "../../middleware/auth";
import { db } from "../../db";
import {
  consultantInstagramConfig,
  superadminInstagramConfig,
  users,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, encryptForConsultant, decrypt } from "../../encryption";
import crypto from "crypto";

const router = Router();

// Facebook OAuth URLs
const FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
const FB_GRAPH_URL = "https://graph.facebook.com/v19.0";

// Required permissions for Instagram Messaging
const SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
].join(",");

/**
 * Helper: Get Super Admin Instagram config
 */
async function getSuperAdminConfig() {
  const [config] = await db
    .select()
    .from(superadminInstagramConfig)
    .where(eq(superadminInstagramConfig.enabled, true))
    .limit(1);
  return config;
}

/**
 * Helper: Decrypt Super Admin App Secret
 */
function decryptAppSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}

/**
 * GET /api/instagram/oauth/status
 * Check if Instagram OAuth is configured and if consultant has a connection
 */
router.get("/oauth/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // Check Super Admin config
    const superAdminConfig = await getSuperAdminConfig();
    
    // Check if consultant has an active Instagram connection
    const [consultantConfig] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(
        and(
          eq(consultantInstagramConfig.consultantId, consultantId),
          eq(consultantInstagramConfig.isActive, true)
        )
      )
      .limit(1);
    
    return res.json({
      configured: !!superAdminConfig,
      enabled: superAdminConfig?.enabled ?? false,
      connected: !!consultantConfig,
      username: consultantConfig?.instagramUsername || null,
      connectedAt: consultantConfig?.createdAt || null,
    });
  } catch (error) {
    console.error("[INSTAGRAM OAUTH] Error checking status:", error);
    return res.status(500).json({ error: "Failed to check OAuth status" });
  }
});

/**
 * GET /api/instagram/oauth/start
 * Start OAuth flow - returns Facebook Login URL
 */
router.get("/oauth/start", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    
    // Get Super Admin config
    const superAdminConfig = await getSuperAdminConfig();
    if (!superAdminConfig) {
      return res.status(400).json({ 
        error: "Instagram OAuth non configurato",
        message: "Contatta il Super Admin per configurare le credenziali Meta App"
      });
    }

    // Generate state token (includes consultant ID for callback)
    const state = Buffer.from(JSON.stringify({
      consultantId,
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
    })).toString("base64url");

    // Build OAuth URL
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/instagram/oauth/callback`;
    
    const authUrl = new URL(FB_AUTH_URL);
    authUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "code");

    console.log(`[INSTAGRAM OAUTH] Started for consultant ${consultantId}`);

    return res.json({
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error("[INSTAGRAM OAUTH] Error starting flow:", error);
    return res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

/**
 * GET /api/instagram/oauth/callback
 * OAuth callback - exchanges code for token and saves config
 */
router.get("/oauth/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      console.error(`[INSTAGRAM OAUTH] Error from Facebook: ${oauthError} - ${error_description}`);
      return res.redirect(`/consultant/api-keys?instagram_error=${encodeURIComponent(String(error_description || oauthError))}`);
    }

    if (!code || !state) {
      return res.redirect("/consultant/api-keys?instagram_error=missing_params");
    }

    // Decode state
    let stateData: { consultantId: string; nonce: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(String(state), "base64url").toString());
    } catch {
      return res.redirect("/consultant/api-keys?instagram_error=invalid_state");
    }

    // Verify state is not too old (5 min max)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return res.redirect("/consultant/api-keys?instagram_error=state_expired");
    }

    const consultantId = stateData.consultantId;

    // Get Super Admin config
    const superAdminConfig = await getSuperAdminConfig();
    if (!superAdminConfig) {
      return res.redirect("/consultant/api-keys?instagram_error=config_missing");
    }

    const appSecret = decryptAppSecret(superAdminConfig.metaAppSecretEncrypted);
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/instagram/oauth/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch(FB_TOKEN_URL, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const tokenUrl = new URL(FB_TOKEN_URL);
    tokenUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", String(code));

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json() as any;

    if (tokenData.error) {
      console.error("[INSTAGRAM OAUTH] Token exchange error:", tokenData.error);
      return res.redirect(`/consultant/api-keys?instagram_error=${encodeURIComponent(tokenData.error.message || "token_error")}`);
    }

    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token
    const longLivedUrl = new URL(`${FB_GRAPH_URL}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedRes.json() as any;

    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 3600;

    // Get user's Facebook Pages
    const pagesRes = await fetch(`${FB_GRAPH_URL}/me/accounts?access_token=${accessToken}`);
    const pagesData = await pagesRes.json() as any;

    console.log(`[INSTAGRAM OAUTH] Pages data:`, JSON.stringify(pagesData, null, 2));

    if (!pagesData.data || pagesData.data.length === 0) {
      console.error(`[INSTAGRAM OAUTH] No Facebook Pages found for user`);
      return res.redirect("/consultant/api-keys?instagram_error=no_pages");
    }

    console.log(`[INSTAGRAM OAUTH] Found ${pagesData.data.length} Facebook Pages`);

    // Get the first page with Instagram account linked
    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;
    let facebookPageId: string | null = null;
    let pageAccessToken: string | null = null;

    for (const page of pagesData.data) {
      console.log(`[INSTAGRAM OAUTH] Checking page: ${page.name} (ID: ${page.id})`);
      
      const igRes = await fetch(`${FB_GRAPH_URL}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`);
      const igData = await igRes.json() as any;

      console.log(`[INSTAGRAM OAUTH] Instagram data for page ${page.name}:`, JSON.stringify(igData, null, 2));

      if (igData.instagram_business_account) {
        instagramAccountId = igData.instagram_business_account.id;
        facebookPageId = page.id;
        pageAccessToken = page.access_token;

        // Get Instagram username
        const igProfileRes = await fetch(`${FB_GRAPH_URL}/${instagramAccountId}?fields=username&access_token=${page.access_token}`);
        const igProfileData = await igProfileRes.json() as any;
        instagramUsername = igProfileData.username || null;

        console.log(`[INSTAGRAM OAUTH] Found Instagram account: @${instagramUsername} (ID: ${instagramAccountId})`);
        break;
      } else {
        console.log(`[INSTAGRAM OAUTH] Page ${page.name} has no Instagram Business account linked`);
      }
    }

    if (!instagramAccountId || !pageAccessToken) {
      console.error(`[INSTAGRAM OAUTH] No Instagram Business account found on any of the ${pagesData.data.length} pages`);
      console.error(`[INSTAGRAM OAUTH] Make sure Instagram account is Business/Creator AND linked to a Facebook Page`);
      return res.redirect("/consultant/api-keys?instagram_error=no_instagram");
    }

    // Get consultant's encryption salt
    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    // Encrypt the page access token
    let encryptedToken: string;
    if (consultant?.encryptionSalt) {
      encryptedToken = encryptForConsultant(pageAccessToken, consultant.encryptionSalt);
    } else {
      encryptedToken = encrypt(pageAccessToken);
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // Check if config exists
    const [existingConfig] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (existingConfig) {
      // Update existing config
      await db
        .update(consultantInstagramConfig)
        .set({
          instagramPageId: instagramAccountId,
          facebookPageId,
          pageAccessToken: encryptedToken,
          tokenExpiresAt,
          isConnected: true,
          connectedAt: new Date(),
          instagramUsername,
          updatedAt: new Date(),
        })
        .where(eq(consultantInstagramConfig.id, existingConfig.id));
    } else {
      // Create new config
      await db
        .insert(consultantInstagramConfig)
        .values({
          consultantId,
          instagramPageId: instagramAccountId,
          facebookPageId,
          pageAccessToken: encryptedToken,
          tokenExpiresAt,
          isConnected: true,
          connectedAt: new Date(),
          instagramUsername,
          agentName: "Agente Instagram",
          isActive: true,
          autoResponseEnabled: true,
          isDryRun: true,
        });
    }

    console.log(`[INSTAGRAM OAUTH] Successfully connected @${instagramUsername} for consultant ${consultantId}`);

    return res.redirect(`/consultant/api-keys?instagram_success=true&username=${encodeURIComponent(instagramUsername || "")}`);
  } catch (error) {
    console.error("[INSTAGRAM OAUTH] Callback error:", error);
    return res.redirect("/consultant/api-keys?instagram_error=callback_failed");
  }
});

/**
 * POST /api/instagram/oauth/disconnect
 * Disconnect Instagram account
 */
router.post("/oauth/disconnect", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [config] = await db
      .select()
      .from(consultantInstagramConfig)
      .where(eq(consultantInstagramConfig.consultantId, consultantId))
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: "No Instagram configuration found" });
    }

    // Clear connection data but keep agent settings
    await db
      .update(consultantInstagramConfig)
      .set({
        instagramPageId: null,
        facebookPageId: null,
        pageAccessToken: null,
        tokenExpiresAt: null,
        isConnected: false,
        connectedAt: null,
        instagramUsername: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantInstagramConfig.id, config.id));

    console.log(`[INSTAGRAM OAUTH] Disconnected for consultant ${consultantId}`);

    return res.json({ success: true, message: "Account Instagram scollegato" });
  } catch (error) {
    console.error("[INSTAGRAM OAUTH] Disconnect error:", error);
    return res.status(500).json({ error: "Failed to disconnect account" });
  }
});

export default router;
