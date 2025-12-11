import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import {
  consultantKnowledgeApis,
  consultantKnowledgeApiCache,
  insertConsultantKnowledgeApiSchema,
  updateConsultantKnowledgeApiSchema,
  users,
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import axios from "axios";
import { encryptForConsultant, decryptForConsultant } from "../encryption";
import { z } from "zod";

const router = Router();

async function getConsultantEncryptionSalt(consultantId: string): Promise<string | null> {
  const [user] = await db
    .select({ encryptionSalt: users.encryptionSalt })
    .from(users)
    .where(eq(users.id, consultantId))
    .limit(1);
  return user?.encryptionSalt || null;
}

function maskApiKey(apiKey: string | null): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "****";
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

router.get(
  "/consultant/knowledge/apis",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const apis = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(eq(consultantKnowledgeApis.consultantId, consultantId))
        .orderBy(desc(consultantKnowledgeApis.createdAt));

      const maskedApis = apis.map((api) => ({
        ...api,
        apiKey: maskApiKey(api.apiKey),
      }));

      res.json({
        success: true,
        data: maskedApis,
        count: maskedApis.length,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Error listing APIs:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list knowledge APIs",
      });
    }
  }
);

router.get(
  "/consultant/knowledge/apis/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [api] = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(
          and(
            eq(consultantKnowledgeApis.id, id),
            eq(consultantKnowledgeApis.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!api) {
        return res.status(404).json({
          success: false,
          error: "API configuration not found",
        });
      }

      const cacheEntries = await db
        .select()
        .from(consultantKnowledgeApiCache)
        .where(eq(consultantKnowledgeApiCache.apiConfigId, id))
        .orderBy(desc(consultantKnowledgeApiCache.updatedAt));

      const cacheStatus = cacheEntries.map((entry) => ({
        cacheKey: entry.cacheKey,
        expiresAt: entry.expiresAt,
        isExpired: new Date(entry.expiresAt) < new Date(),
        updatedAt: entry.updatedAt,
        hasSummary: !!entry.dataSummary,
      }));

      res.json({
        success: true,
        data: {
          ...api,
          apiKey: maskApiKey(api.apiKey),
          cacheStatus,
        },
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Error fetching API:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch knowledge API",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/apis",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const validatedData = insertConsultantKnowledgeApiSchema.parse({
        ...req.body,
        consultantId,
      });

      let encryptedApiKey: string | null = null;
      if (validatedData.apiKey) {
        const encryptionSalt = await getConsultantEncryptionSalt(consultantId);
        if (encryptionSalt) {
          encryptedApiKey = encryptForConsultant(validatedData.apiKey, encryptionSalt);
        } else {
          encryptedApiKey = validatedData.apiKey;
        }
      }

      const [newApi] = await db
        .insert(consultantKnowledgeApis)
        .values({
          ...validatedData,
          apiKey: encryptedApiKey,
        })
        .returning();

      res.status(201).json({
        success: true,
        data: {
          ...newApi,
          apiKey: maskApiKey(validatedData.apiKey || null),
        },
        message: "API configuration created successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Error creating API:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to create knowledge API",
      });
    }
  }
);

router.put(
  "/consultant/knowledge/apis/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [existingApi] = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(
          and(
            eq(consultantKnowledgeApis.id, id),
            eq(consultantKnowledgeApis.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingApi) {
        return res.status(404).json({
          success: false,
          error: "API configuration not found",
        });
      }

      const validatedData = updateConsultantKnowledgeApiSchema.parse(req.body);

      let encryptedApiKey: string | undefined;
      if (validatedData.apiKey !== undefined) {
        if (validatedData.apiKey) {
          const encryptionSalt = await getConsultantEncryptionSalt(consultantId);
          if (encryptionSalt) {
            encryptedApiKey = encryptForConsultant(validatedData.apiKey, encryptionSalt);
          } else {
            encryptedApiKey = validatedData.apiKey;
          }
        } else {
          encryptedApiKey = "";
        }
      }

      const updateData: any = { ...validatedData, updatedAt: new Date() };
      if (encryptedApiKey !== undefined) {
        updateData.apiKey = encryptedApiKey;
      }

      const [updatedApi] = await db
        .update(consultantKnowledgeApis)
        .set(updateData)
        .where(eq(consultantKnowledgeApis.id, id))
        .returning();

      res.json({
        success: true,
        data: {
          ...updatedApi,
          apiKey: maskApiKey(validatedData.apiKey || existingApi.apiKey),
        },
        message: "API configuration updated successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Error updating API:", error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || "Failed to update knowledge API",
      });
    }
  }
);

router.delete(
  "/consultant/knowledge/apis/:id",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [existingApi] = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(
          and(
            eq(consultantKnowledgeApis.id, id),
            eq(consultantKnowledgeApis.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingApi) {
        return res.status(404).json({
          success: false,
          error: "API configuration not found",
        });
      }

      await db
        .delete(consultantKnowledgeApiCache)
        .where(eq(consultantKnowledgeApiCache.apiConfigId, id));

      await db
        .delete(consultantKnowledgeApis)
        .where(eq(consultantKnowledgeApis.id, id));

      res.json({
        success: true,
        message: "API configuration deleted successfully",
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Error deleting API:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete knowledge API",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/apis/:id/test",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;

      const [api] = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(
          and(
            eq(consultantKnowledgeApis.id, id),
            eq(consultantKnowledgeApis.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!api) {
        return res.status(404).json({
          success: false,
          error: "API configuration not found",
        });
      }

      let decryptedApiKey: string | null = null;
      if (api.apiKey) {
        try {
          const encryptionSalt = await getConsultantEncryptionSalt(consultantId);
          if (encryptionSalt) {
            decryptedApiKey = decryptForConsultant(api.apiKey, encryptionSalt);
          } else {
            decryptedApiKey = api.apiKey;
          }
        } catch {
          decryptedApiKey = api.apiKey;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(api.customHeaders as Record<string, string> || {}),
      };

      if (api.authType === "api_key" && decryptedApiKey) {
        const headerName = (api.authConfig as any)?.headerName || "X-API-Key";
        headers[headerName] = decryptedApiKey;
      } else if (api.authType === "bearer" && decryptedApiKey) {
        headers["Authorization"] = `Bearer ${decryptedApiKey}`;
      } else if (api.authType === "basic" && decryptedApiKey) {
        headers["Authorization"] = `Basic ${Buffer.from(decryptedApiKey).toString("base64")}`;
      }

      const testUrl = api.endpoint ? `${api.baseUrl}${api.endpoint}` : api.baseUrl;
      const startTime = Date.now();

      const response = await axios({
        method: api.requestMethod || "GET",
        url: testUrl,
        headers,
        params: api.requestMethod === "GET" ? (api.requestParams as object) : undefined,
        data: api.requestMethod === "POST" ? (api.requestParams as object) : undefined,
        timeout: 15000,
        validateStatus: () => true,
      });

      const responseTime = Date.now() - startTime;
      const isSuccess = response.status >= 200 && response.status < 300;

      await db
        .update(consultantKnowledgeApis)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: isSuccess ? "success" : "error",
          lastSyncError: isSuccess ? null : `HTTP ${response.status}: ${response.statusText}`,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeApis.id, id));

      res.json({
        success: isSuccess,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        dataPreview: isSuccess
          ? typeof response.data === "object"
            ? JSON.stringify(response.data).substring(0, 500)
            : String(response.data).substring(0, 500)
          : null,
        error: !isSuccess ? `HTTP ${response.status}: ${response.statusText}` : null,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Test connection error:", error);

      await db
        .update(consultantKnowledgeApis)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: "error",
          lastSyncError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeApis.id, req.params.id));

      res.status(500).json({
        success: false,
        error: error.message || "Connection test failed",
      });
    }
  }
);

router.post(
  "/consultant/knowledge/apis/:id/sync",
  authenticateToken,
  requireRole("consultant"),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const consultantId = req.user!.id;
      const { cacheKey = "default" } = req.body;

      const [api] = await db
        .select()
        .from(consultantKnowledgeApis)
        .where(
          and(
            eq(consultantKnowledgeApis.id, id),
            eq(consultantKnowledgeApis.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!api) {
        return res.status(404).json({
          success: false,
          error: "API configuration not found",
        });
      }

      if (!api.isActive) {
        return res.status(400).json({
          success: false,
          error: "API configuration is not active",
        });
      }

      let decryptedApiKey: string | null = null;
      if (api.apiKey) {
        try {
          const encryptionSalt = await getConsultantEncryptionSalt(consultantId);
          if (encryptionSalt) {
            decryptedApiKey = decryptForConsultant(api.apiKey, encryptionSalt);
          } else {
            decryptedApiKey = api.apiKey;
          }
        } catch {
          decryptedApiKey = api.apiKey;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(api.customHeaders as Record<string, string> || {}),
      };

      if (api.authType === "api_key" && decryptedApiKey) {
        const headerName = (api.authConfig as any)?.headerName || "X-API-Key";
        headers[headerName] = decryptedApiKey;
      } else if (api.authType === "bearer" && decryptedApiKey) {
        headers["Authorization"] = `Bearer ${decryptedApiKey}`;
      } else if (api.authType === "basic" && decryptedApiKey) {
        headers["Authorization"] = `Basic ${Buffer.from(decryptedApiKey).toString("base64")}`;
      }

      const syncUrl = api.endpoint ? `${api.baseUrl}${api.endpoint}` : api.baseUrl;

      const response = await axios({
        method: api.requestMethod || "GET",
        url: syncUrl,
        headers,
        params: api.requestMethod === "GET" ? (api.requestParams as object) : undefined,
        data: api.requestMethod === "POST" ? (api.requestParams as object) : undefined,
        timeout: 30000,
      });

      const cacheDuration = api.cacheDurationMinutes || 60;
      const expiresAt = new Date(Date.now() + cacheDuration * 60 * 1000);

      const [existingCache] = await db
        .select()
        .from(consultantKnowledgeApiCache)
        .where(
          and(
            eq(consultantKnowledgeApiCache.apiConfigId, id),
            eq(consultantKnowledgeApiCache.cacheKey, cacheKey)
          )
        )
        .limit(1);

      if (existingCache) {
        await db
          .update(consultantKnowledgeApiCache)
          .set({
            cachedData: response.data,
            expiresAt,
            updatedAt: new Date(),
          })
          .where(eq(consultantKnowledgeApiCache.id, existingCache.id));
      } else {
        await db.insert(consultantKnowledgeApiCache).values({
          apiConfigId: id,
          consultantId,
          cacheKey,
          cachedData: response.data,
          expiresAt,
        });
      }

      await db
        .update(consultantKnowledgeApis)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: "success",
          lastSyncError: null,
          usageCount: (api.usageCount || 0) + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeApis.id, id));

      res.json({
        success: true,
        message: "Data synchronized successfully",
        cacheKey,
        expiresAt,
        dataSize: JSON.stringify(response.data).length,
      });
    } catch (error: any) {
      console.error("❌ [KNOWLEDGE APIS] Sync error:", error);

      await db
        .update(consultantKnowledgeApis)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: "error",
          lastSyncError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(consultantKnowledgeApis.id, req.params.id));

      res.status(500).json({
        success: false,
        error: error.message || "Sync failed",
      });
    }
  }
);

export default router;
