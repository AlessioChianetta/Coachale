import { Router } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertUserFinanceSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { PercorsoCapitaleClient } from "../percorso-capitale-client";

const router = Router();

const financeSettingsSchema = z.object({
  percorsoCapitaleEmail: z.string().email("Email non valida"),
  isEnabled: z.boolean().default(true),
});

router.get("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    console.log(`[FinanceSettings] GET request for user ${userId}`);
    
    const settings = await storage.getUserFinanceSettings(userId);
    
    if (!settings) {
      console.log(`[FinanceSettings] No settings found for user ${userId}`);
      return res.json(null);
    }
    
    console.log(`[FinanceSettings] Settings found for user ${userId}, enabled: ${settings.isEnabled}`);
    
    res.json({
      id: settings.id,
      percorsoCapitaleEmail: settings.percorsoCapitaleEmail,
      isEnabled: settings.isEnabled,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (error: any) {
    console.error(`[FinanceSettings] GET error:`, error);
    res.status(500).json({ 
      message: "Errore durante il recupero delle impostazioni finanziarie",
      error: error.message 
    });
  }
});

router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    console.log(`[FinanceSettings] POST request for user ${userId}`, {
      body: { ...req.body, percorsoCapitaleEmail: req.body.percorsoCapitaleEmail ? '***' : undefined }
    });
    
    const validatedData = financeSettingsSchema.parse(req.body);
    
    const existingSettings = await storage.getUserFinanceSettings(userId);
    
    let settings;
    if (existingSettings) {
      console.log(`[FinanceSettings] Updating existing settings for user ${userId}`);
      
      settings = await storage.updateUserFinanceSettings(userId, {
        percorsoCapitaleEmail: validatedData.percorsoCapitaleEmail,
        isEnabled: validatedData.isEnabled,
      });
      
      if (!settings) {
        throw new Error("Impossibile aggiornare le impostazioni");
      }
      
      console.log(`[FinanceSettings] Settings updated successfully for user ${userId}`);
    } else {
      console.log(`[FinanceSettings] Creating new settings for user ${userId}`);
      
      settings = await storage.createUserFinanceSettings({
        clientId: userId,
        percorsoCapitaleEmail: validatedData.percorsoCapitaleEmail,
        isEnabled: validatedData.isEnabled,
      });
      
      console.log(`[FinanceSettings] Settings created successfully for user ${userId}`);
    }
    
    if (settings.isEnabled && process.env.PERCORSO_CAPITALE_API_KEY && process.env.PERCORSO_CAPITALE_BASE_URL) {
      try {
        const client = PercorsoCapitaleClient.getInstance(
          process.env.PERCORSO_CAPITALE_API_KEY,
          process.env.PERCORSO_CAPITALE_BASE_URL,
          settings.percorsoCapitaleEmail
        );
        
        const dashboard = await client.getDashboard();
        if (dashboard) {
          console.log(`[FinanceSettings] Successfully tested connection to Percorso Capitale for user ${userId}`);
        } else {
          console.warn(`[FinanceSettings] Connection test returned null for user ${userId}`);
        }
      } catch (error: any) {
        console.warn(`[FinanceSettings] Failed to test connection to Percorso Capitale:`, error.message);
      }
    }
    
    res.status(existingSettings ? 200 : 201).json({
      id: settings.id,
      percorsoCapitaleEmail: settings.percorsoCapitaleEmail,
      isEnabled: settings.isEnabled,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    });
  } catch (error: any) {
    console.error(`[FinanceSettings] POST error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Dati non validi",
        errors: error.errors 
      });
    }
    
    res.status(500).json({ 
      message: "Errore durante il salvataggio delle impostazioni finanziarie",
      error: error.message 
    });
  }
});

router.delete("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    console.log(`[FinanceSettings] DELETE request for user ${userId}`);
    
    const existingSettings = await storage.getUserFinanceSettings(userId);
    
    if (!existingSettings) {
      console.log(`[FinanceSettings] No settings to delete for user ${userId}`);
      return res.status(404).json({ 
        message: "Nessuna configurazione trovata" 
      });
    }
    
    const deleted = await storage.deleteUserFinanceSettings(userId);
    
    if (!deleted) {
      throw new Error("Impossibile eliminare le impostazioni");
    }
    
    if (process.env.PERCORSO_CAPITALE_API_KEY && process.env.PERCORSO_CAPITALE_BASE_URL) {
      try {
        const client = PercorsoCapitaleClient.getInstance(
          process.env.PERCORSO_CAPITALE_API_KEY,
          process.env.PERCORSO_CAPITALE_BASE_URL,
          existingSettings.percorsoCapitaleEmail
        );
        
        client.clearCache();
        console.log(`[FinanceSettings] Cache cleared for user ${userId}`);
      } catch (error: any) {
        console.warn(`[FinanceSettings] Failed to clear cache:`, error.message);
      }
    }
    
    console.log(`[FinanceSettings] Settings deleted successfully for user ${userId}`);
    
    res.json({ 
      message: "Impostazioni eliminate con successo" 
    });
  } catch (error: any) {
    console.error(`[FinanceSettings] DELETE error:`, error);
    res.status(500).json({ 
      message: "Errore durante l'eliminazione delle impostazioni finanziarie",
      error: error.message 
    });
  }
});

// External Services - SiteAle URL configuration
const siteUrlSchema = z.object({
  siteUrl: z.string().url("URL non valido").optional().or(z.literal("")),
});

router.get("/site-url", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({ siteUrl: user.siteUrl || "" });
  } catch (error: any) {
    console.error(`[SiteUrl] GET error:`, error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/site-url", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { siteUrl } = siteUrlSchema.parse(req.body);
    
    console.log(`[SiteUrl] Updating for user ${userId}: ${siteUrl || "(empty)"}`);
    
    // Update user's siteUrl
    const { db, schema } = await import("../db");
    const { eq } = await import("drizzle-orm");
    
    await db.update(schema.users)
      .set({ siteUrl: siteUrl || null })
      .where(eq(schema.users.id, userId));
    
    console.log(`[SiteUrl] Updated successfully for user ${userId}`);
    
    res.json({ 
      success: true, 
      siteUrl: siteUrl || null,
      message: "URL del sito aggiornato con successo" 
    });
  } catch (error: any) {
    console.error(`[SiteUrl] POST error:`, error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
