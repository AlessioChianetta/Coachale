import { Router, Response, Request } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import {
  consultantMetaAdsConfig,
  superadminInstagramConfig,
  users,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, encryptForConsultant, decrypt } from "../encryption";
import crypto from "crypto";

interface MetaErrorResponse {
  error?: { message?: string; type?: string; code?: number };
}

interface MetaTokenResponse extends MetaErrorResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

interface MetaAdAccount {
  id?: string;
  account_id?: string;
  name?: string;
  account_status?: number;
  business?: { id?: string; name?: string };
}

interface MetaAdAccountsResponse extends MetaErrorResponse {
  data?: MetaAdAccount[];
}

const router = Router();

const FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";

function getStateSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("[META-ADS OAUTH] SESSION_SECRET or ENCRYPTION_KEY must be configured for OAuth state signing");
  }
  return secret;
}

function signState(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyState(state: string): Record<string, string> | null {
  const parts = String(state).split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", getStateSecret()).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
}
const FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
const FB_GRAPH_URL = "https://graph.facebook.com/v19.0";

const ADS_SCOPES = [
  "public_profile",
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
].join(",");

async function getSuperAdminConfig() {
  const [config] = await db
    .select()
    .from(superadminInstagramConfig)
    .where(eq(superadminInstagramConfig.enabled, true))
    .limit(1);
  return config;
}

function decryptAppSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}

router.get("/oauth/status", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const superAdminConfig = await getSuperAdminConfig();

    const [config] = await db
      .select()
      .from(consultantMetaAdsConfig)
      .where(
        and(
          eq(consultantMetaAdsConfig.consultantId, consultantId),
          eq(consultantMetaAdsConfig.isActive, true)
        )
      )
      .limit(1);

    return res.json({
      configured: !!superAdminConfig,
      enabled: superAdminConfig?.enabled ?? false,
      connected: !!config?.isConnected,
      adAccountId: config?.adAccountId || null,
      adAccountName: config?.adAccountName || null,
      businessName: config?.businessName || null,
      connectedAt: config?.connectedAt || null,
      lastSyncedAt: config?.lastSyncedAt || null,
      syncEnabled: config?.syncEnabled ?? true,
      syncError: config?.syncError || null,
    });
  } catch (error) {
    console.error("[META-ADS OAUTH] Error checking status:", error);
    return res.status(500).json({ error: "Failed to check OAuth status" });
  }
});

router.get("/oauth/start", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const superAdminConfig = await getSuperAdminConfig();
    if (!superAdminConfig) {
      return res.status(400).json({
        error: "Meta Ads OAuth non configurato",
        message: "Contatta il Super Admin per configurare le credenziali Meta App",
      });
    }

    const state = signState({
      consultantId,
      flow: "meta_ads",
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
    });

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/meta-ads/oauth/callback`;

    const authUrl = new URL(FB_AUTH_URL);
    authUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", ADS_SCOPES);
    authUrl.searchParams.set("response_type", "code");

    console.log(`[META-ADS OAUTH] Started for consultant ${consultantId}`);

    return res.json({
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error("[META-ADS OAUTH] Error starting flow:", error);
    return res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

router.get("/oauth/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      console.error(`[META-ADS OAUTH] Error from Facebook: ${oauthError} - ${error_description}`);
      return res.redirect(
        `/consultant/content-studio/facebook-ads?meta_ads_error=${encodeURIComponent(String(error_description || oauthError))}`
      );
    }

    if (!code || !state) {
      return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_error=missing_params");
    }

    const stateData = verifyState(String(state)) as { consultantId: string; flow: string; nonce: string; timestamp: number } | null;
    if (!stateData) {
      return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_error=invalid_state");
    }

    if (stateData.flow !== "meta_ads") {
      return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_error=invalid_flow");
    }

    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_error=state_expired");
    }

    const consultantId = stateData.consultantId;

    const superAdminConfig = await getSuperAdminConfig();
    if (!superAdminConfig) {
      return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_error=config_missing");
    }

    const appSecret = decryptAppSecret(superAdminConfig.metaAppSecretEncrypted);
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${baseUrl}/api/meta-ads/oauth/callback`;

    const tokenUrl = new URL(FB_TOKEN_URL);
    tokenUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", String(code));

    const tokenRes = await fetch(tokenUrl.toString());
    if (!tokenRes.ok) {
      console.error(`[META-ADS OAUTH] Token exchange HTTP error: ${tokenRes.status}`);
      return res.redirect(`/consultant/content-studio/facebook-ads?meta_ads_error=token_exchange_failed`);
    }
    const tokenData: MetaTokenResponse = await tokenRes.json();

    if (tokenData.error) {
      console.error("[META-ADS OAUTH] Token exchange error:", tokenData.error);
      return res.redirect(
        `/consultant/content-studio/facebook-ads?meta_ads_error=${encodeURIComponent(tokenData.error.message || "token_exchange_failed")}`
      );
    }

    const shortLivedToken = tokenData.access_token;

    const longLivedUrl = new URL(FB_TOKEN_URL);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", superAdminConfig.metaAppId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const longLivedRes = await fetch(longLivedUrl.toString());
    const longLivedData: MetaTokenResponse = await longLivedRes.json();

    const accessToken = longLivedData.access_token || shortLivedToken;
    const expiresIn = longLivedData.expires_in || 5184000;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    console.log(`[META-ADS OAUTH] Got long-lived token (expires in ${Math.round(expiresIn / 86400)} days)`);

    const adAccountsRes = await fetch(
      `${FB_GRAPH_URL}/me/adaccounts?fields=account_id,name,account_status,business{id,name}&access_token=${accessToken}`
    );
    const adAccountsData: MetaAdAccountsResponse = await adAccountsRes.json();

    if (adAccountsData.error) {
      console.error("[META-ADS OAUTH] Error fetching ad accounts:", adAccountsData.error);
      return res.redirect(
        `/consultant/content-studio/facebook-ads?meta_ads_error=${encodeURIComponent("Impossibile recuperare gli Ad Account. Assicurati di avere un Business Manager con account pubblicitari.")}`
      );
    }

    const adAccounts = adAccountsData.data || [];
    if (adAccounts.length === 0) {
      return res.redirect(
        `/consultant/content-studio/facebook-ads?meta_ads_error=${encodeURIComponent("Nessun Ad Account trovato. Verifica di avere un account pubblicitario attivo nel Business Manager.")}`
      );
    }

    const activeAccount = adAccounts.find((a: MetaAdAccount) => a.account_status === 1) || adAccounts[0];

    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    const encryptedToken = consultant?.encryptionSalt
      ? encryptForConsultant(accessToken, consultant.encryptionSalt)
      : encrypt(accessToken);

    const [existing] = await db
      .select()
      .from(consultantMetaAdsConfig)
      .where(eq(consultantMetaAdsConfig.consultantId, consultantId))
      .limit(1);

    if (existing) {
      await db
        .update(consultantMetaAdsConfig)
        .set({
          adAccountId: activeAccount.account_id || activeAccount.id?.replace("act_", ""),
          adAccountName: activeAccount.name,
          businessId: activeAccount.business?.id || null,
          businessName: activeAccount.business?.name || null,
          accessToken: encryptedToken,
          tokenExpiresAt,
          isActive: true,
          isConnected: true,
          connectedAt: new Date(),
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(consultantMetaAdsConfig.id, existing.id));
    } else {
      await db.insert(consultantMetaAdsConfig).values({
        consultantId,
        adAccountId: activeAccount.account_id || activeAccount.id?.replace("act_", ""),
        adAccountName: activeAccount.name,
        businessId: activeAccount.business?.id || null,
        businessName: activeAccount.business?.name || null,
        accessToken: encryptedToken,
        tokenExpiresAt,
        isActive: true,
        isConnected: true,
        connectedAt: new Date(),
      });
    }

    console.log(
      `[META-ADS OAUTH] ✅ Connected ad account "${activeAccount.name}" (${activeAccount.account_id || activeAccount.id}) for consultant ${consultantId}`
    );

    return res.redirect("/consultant/content-studio/facebook-ads?meta_ads_connected=true");
  } catch (error: any) {
    console.error("[META-ADS OAUTH] Callback error:", error);
    return res.redirect(
      `/consultant/content-studio/facebook-ads?meta_ads_error=${encodeURIComponent("Errore durante la connessione. Riprova.")}`
    );
  }
});

router.post("/oauth/disconnect", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    await db
      .update(consultantMetaAdsConfig)
      .set({
        isActive: false,
        isConnected: false,
        accessToken: null,
        syncEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(consultantMetaAdsConfig.consultantId, consultantId));

    console.log(`[META-ADS OAUTH] Disconnected for consultant ${consultantId}`);

    return res.json({ success: true });
  } catch (error) {
    console.error("[META-ADS OAUTH] Error disconnecting:", error);
    return res.status(500).json({ error: "Failed to disconnect" });
  }
});

router.get("/oauth/ad-accounts", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const [config] = await db
      .select()
      .from(consultantMetaAdsConfig)
      .where(
        and(
          eq(consultantMetaAdsConfig.consultantId, consultantId),
          eq(consultantMetaAdsConfig.isConnected, true)
        )
      )
      .limit(1);

    if (!config?.accessToken) {
      return res.status(400).json({ error: "Account Meta Ads non connesso" });
    }

    const [consultant] = await db
      .select({ encryptionSalt: users.encryptionSalt })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    let token: string;
    try {
      const { decryptForConsultant } = await import("../encryption");
      token = consultant?.encryptionSalt
        ? decryptForConsultant(config.accessToken, consultant.encryptionSalt)
        : decrypt(config.accessToken);
    } catch {
      token = decrypt(config.accessToken);
    }

    const adAccountsRes = await fetch(
      `${FB_GRAPH_URL}/me/adaccounts?fields=account_id,name,account_status,business{id,name}&access_token=${token}`
    );
    const adAccountsData: MetaAdAccountsResponse = await adAccountsRes.json();

    if (adAccountsData.error) {
      return res.status(400).json({ error: "Token scaduto, ricollega l'account" });
    }

    return res.json({
      adAccounts: (adAccountsData.data || []).map((a: MetaAdAccount) => ({
        id: a.account_id || a.id?.replace("act_", ""),
        name: a.name,
        status: a.account_status === 1 ? "active" : "inactive",
        business: a.business?.name || null,
      })),
      currentAccountId: config.adAccountId,
    });
  } catch (error) {
    console.error("[META-ADS] Error fetching ad accounts:", error);
    return res.status(500).json({ error: "Failed to fetch ad accounts" });
  }
});

router.post("/oauth/switch-account", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { adAccountId, adAccountName } = req.body;

    if (!adAccountId) {
      return res.status(400).json({ error: "adAccountId richiesto" });
    }

    await db
      .update(consultantMetaAdsConfig)
      .set({
        adAccountId,
        adAccountName: adAccountName || null,
        lastSyncedAt: null,
        syncError: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantMetaAdsConfig.consultantId, consultantId));

    return res.json({ success: true });
  } catch (error) {
    console.error("[META-ADS] Error switching account:", error);
    return res.status(500).json({ error: "Failed to switch account" });
  }
});

export default router;
