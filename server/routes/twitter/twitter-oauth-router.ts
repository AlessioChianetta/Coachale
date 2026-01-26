/**
 * Twitter/X OAuth Router
 * Handles OAuth 1.0a and OAuth 2.0 authentication flows
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import OAuth from "oauth-1.0a";
import { db } from "../../db";
import {
  consultantTwitterConfig,
  superadminTwitterConfig,
} from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../../encryption";

const router = Router();

// Temporary storage for OAuth tokens (in production, use Redis or DB)
const oauthTokenSecrets: Map<string, { secret: string; consultantId: string }> = new Map();

/**
 * GET /api/twitter/oauth/url
 * Generate OAuth 1.0a authorization URL
 */
router.get("/url", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;

    // Get superadmin config for API keys
    const [superAdminConfig] = await db
      .select()
      .from(superadminTwitterConfig)
      .where(eq(superadminTwitterConfig.enabled, true))
      .limit(1);

    if (!superAdminConfig?.apiKeyEncrypted || !superAdminConfig?.apiSecretEncrypted) {
      return res.status(500).json({ 
        error: "Twitter API non configurato",
        message: "Contatta l'amministratore per configurare le credenziali Twitter"
      });
    }

    const apiKey = decrypt(superAdminConfig.apiKeyEncrypted);
    const apiSecret = decrypt(superAdminConfig.apiSecretEncrypted);

    // Create OAuth 1.0a instance
    const oauth = new OAuth({
      consumer: { key: apiKey, secret: apiSecret },
      signature_method: "HMAC-SHA1",
      hash_function(baseString, key) {
        return crypto.createHmac("sha1", key).update(baseString).digest("base64");
      },
    });

    // Build callback URL
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "http://localhost:5000";
    
    const callbackUrl = `${baseUrl}/api/twitter/oauth/callback`;

    // Request token from Twitter
    const requestTokenUrl = "https://api.x.com/oauth/request_token";
    
    const requestData = {
      url: requestTokenUrl,
      method: "POST",
      data: { oauth_callback: callbackUrl },
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData)) as Record<string, string>;

    const response = await fetch(requestTokenUrl, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `oauth_callback=${encodeURIComponent(callbackUrl)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitter request token error:", errorText);
      return res.status(500).json({ error: "Errore nella richiesta del token" });
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);
    
    const oauthToken = params.get("oauth_token");
    const oauthTokenSecret = params.get("oauth_token_secret");
    const callbackConfirmed = params.get("oauth_callback_confirmed");

    if (!oauthToken || !oauthTokenSecret || callbackConfirmed !== "true") {
      return res.status(500).json({ error: "Risposta token non valida" });
    }

    // Store token secret for callback verification
    oauthTokenSecrets.set(oauthToken, {
      secret: oauthTokenSecret,
      consultantId,
    });

    // Clean up old tokens after 10 minutes
    setTimeout(() => {
      oauthTokenSecrets.delete(oauthToken);
    }, 10 * 60 * 1000);

    // Build authorization URL
    const authorizationUrl = `https://api.x.com/oauth/authorize?oauth_token=${oauthToken}`;

    res.json({ url: authorizationUrl });
  } catch (error) {
    console.error("Error generating OAuth URL:", error);
    res.status(500).json({ error: "Errore nella generazione dell'URL OAuth" });
  }
});

/**
 * GET /api/twitter/oauth/callback
 * OAuth callback handler
 */
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { oauth_token, oauth_verifier, denied } = req.query;

    // User denied access
    if (denied) {
      return res.redirect("/consultant/whatsapp?twitter_error=denied");
    }

    if (!oauth_token || !oauth_verifier) {
      return res.redirect("/consultant/whatsapp?twitter_error=missing_params");
    }

    // Get stored token secret
    const storedData = oauthTokenSecrets.get(oauth_token as string);
    if (!storedData) {
      return res.redirect("/consultant/whatsapp?twitter_error=expired_token");
    }

    const { secret: oauthTokenSecret, consultantId } = storedData;
    oauthTokenSecrets.delete(oauth_token as string);

    // Get superadmin config for API keys
    const [superAdminConfig] = await db
      .select()
      .from(superadminTwitterConfig)
      .where(eq(superadminTwitterConfig.enabled, true))
      .limit(1);

    if (!superAdminConfig?.apiKeyEncrypted || !superAdminConfig?.apiSecretEncrypted) {
      return res.redirect("/consultant/whatsapp?twitter_error=config_missing");
    }

    const apiKey = decrypt(superAdminConfig.apiKeyEncrypted);
    const apiSecret = decrypt(superAdminConfig.apiSecretEncrypted);

    // Create OAuth instance
    const oauth = new OAuth({
      consumer: { key: apiKey, secret: apiSecret },
      signature_method: "HMAC-SHA1",
      hash_function(baseString, key) {
        return crypto.createHmac("sha1", key).update(baseString).digest("base64");
      },
    });

    // Exchange for access token
    const accessTokenUrl = "https://api.x.com/oauth/access_token";
    
    const requestData = {
      url: accessTokenUrl,
      method: "POST",
    };

    const token = {
      key: oauth_token as string,
      secret: oauthTokenSecret,
    };

    const authHeader = oauth.toHeader(oauth.authorize(requestData, token)) as Record<string, string>;

    const response = await fetch(accessTokenUrl, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `oauth_verifier=${oauth_verifier}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitter access token error:", errorText);
      return res.redirect("/consultant/whatsapp?twitter_error=token_exchange");
    }

    const responseText = await response.text();
    const params = new URLSearchParams(responseText);

    const accessToken = params.get("oauth_token");
    const accessTokenSecretNew = params.get("oauth_token_secret");
    const userId = params.get("user_id");
    const screenName = params.get("screen_name");

    if (!accessToken || !accessTokenSecretNew || !userId) {
      return res.redirect("/consultant/whatsapp?twitter_error=invalid_response");
    }

    console.log(`✅ [TWITTER OAUTH] Connected @${screenName} (${userId}) for consultant ${consultantId}`);

    // Check if config already exists for this user
    const [existingConfig] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.consultantId, consultantId),
          eq(consultantTwitterConfig.twitterUserId, userId)
        )
      )
      .limit(1);

    if (existingConfig) {
      // Update existing config
      await db
        .update(consultantTwitterConfig)
        .set({
          accessToken: encrypt(accessToken),
          accessTokenSecret: encrypt(accessTokenSecretNew),
          twitterUsername: screenName,
          isConnected: true,
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(consultantTwitterConfig.id, existingConfig.id));
    } else {
      // Create new config
      await db.insert(consultantTwitterConfig).values({
        consultantId,
        twitterUserId: userId,
        twitterUsername: screenName,
        accessToken: encrypt(accessToken),
        accessTokenSecret: encrypt(accessTokenSecretNew),
        isConnected: true,
        connectedAt: new Date(),
      });
    }

    res.redirect("/consultant/whatsapp?twitter_connected=true");
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    res.redirect("/consultant/whatsapp?twitter_error=callback_failed");
  }
});

/**
 * POST /api/twitter/oauth/disconnect
 * Disconnect Twitter account
 */
router.post("/disconnect", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { configId } = req.body;

    if (!configId) {
      return res.status(400).json({ error: "configId richiesto" });
    }

    // Verify ownership and disconnect
    const [updated] = await db
      .update(consultantTwitterConfig)
      .set({
        isConnected: false,
        accessToken: null,
        accessTokenSecret: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(consultantTwitterConfig.id, configId),
          eq(consultantTwitterConfig.consultantId, consultantId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Configurazione non trovata" });
    }

    res.json({ success: true, message: "Account X disconnesso" });
  } catch (error) {
    console.error("Error disconnecting Twitter:", error);
    res.status(500).json({ error: "Errore nella disconnessione" });
  }
});

/**
 * POST /api/twitter/webhook/register
 * Register webhook for the current user
 */
router.post("/webhook/register", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Non autorizzato" });
    }

    const consultantId = user.role === "consultant" ? user.id : user.consultantId;
    const { configId } = req.body;

    if (!configId) {
      return res.status(400).json({ error: "configId richiesto" });
    }

    // Get config
    const [config] = await db
      .select()
      .from(consultantTwitterConfig)
      .where(
        and(
          eq(consultantTwitterConfig.id, configId),
          eq(consultantTwitterConfig.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!config || !config.accessToken || !config.accessTokenSecret) {
      return res.status(400).json({ error: "Account non connesso" });
    }

    // Get superadmin config
    const [superAdminConfig] = await db
      .select()
      .from(superadminTwitterConfig)
      .where(eq(superadminTwitterConfig.enabled, true))
      .limit(1);

    if (!superAdminConfig?.apiKeyEncrypted) {
      return res.status(500).json({ error: "Configurazione API mancante" });
    }

    // Import TwitterClient
    const { TwitterClient } = await import("../../twitter/twitter-client");

    const client = new TwitterClient({
      apiKey: decrypt(superAdminConfig.apiKeyEncrypted),
      apiSecret: decrypt(superAdminConfig.apiSecretEncrypted!),
      accessToken: decrypt(config.accessToken),
      accessTokenSecret: decrypt(config.accessTokenSecret),
    });

    // Subscribe to webhook
    const envName = config.webhookEnvName || "production";
    await client.subscribeToWebhook(envName);

    res.json({ success: true, message: "Webhook registrato con successo" });
  } catch (error) {
    console.error("Error registering webhook:", error);
    res.status(500).json({ error: "Errore nella registrazione del webhook" });
  }
});

export default router;
