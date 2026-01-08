import { Router } from "express";
import { type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { z } from "zod";
import { createImapService, ImapIdleManager, ParsedEmail } from "../services/email-hub/imap-service";
import { createSmtpService } from "../services/email-hub/smtp-service";
import { classifyEmail, generateEmailDraft, classifyAndGenerateDraft } from "../services/email-hub/email-ai-service";
import { classifyEmailProvider, isSendOnlyProvider, ITALIAN_PROVIDERS } from "../services/email-hub/provider-classifier";

const router = Router();

const baseAccountSchema = z.object({
  displayName: z.string().min(1).max(100),
  emailAddress: z.string().email(),
  accountType: z.enum(["smtp_only", "imap_only", "full", "hybrid"]).default("full"),
  imapHost: z.string().min(1).optional(),
  imapPort: z.number().int().min(1).max(65535).default(993).optional(),
  imapUser: z.string().min(1).optional(),
  imapPassword: z.string().min(1).optional(),
  imapTls: z.boolean().default(true).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.number().int().min(1).max(65535).default(587).optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPassword: z.string().min(1).optional(),
  smtpTls: z.boolean().default(true).optional(),
  autoReplyMode: z.enum(["off", "review", "auto"]).default("review"),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
  aiTone: z.enum(["formal", "friendly", "professional"]).default("formal"),
  signature: z.string().optional(),
});

const createAccountSchema = baseAccountSchema.refine(data => {
  if (data.accountType === "smtp_only" || data.accountType === "full" || data.accountType === "hybrid") {
    return data.smtpHost && data.smtpUser && data.smtpPassword;
  }
  return true;
}, { message: "SMTP configuration required" }).refine(data => {
  if (data.accountType === "imap_only" || data.accountType === "full" || data.accountType === "hybrid") {
    return data.imapHost && data.imapUser && data.imapPassword;
  }
  return true;
}, { message: "IMAP configuration required" });

const updateAccountSchema = baseAccountSchema.partial();

router.get("/accounts", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const accounts = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, consultantId))
      .orderBy(desc(schema.emailAccounts.createdAt));
    
    const sanitizedAccounts = accounts.map((acc) => ({
      ...acc,
      imapPassword: undefined,
      smtpPassword: undefined,
    }));
    
    res.json({ success: true, data: sanitizedAccounts });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error fetching accounts:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const validated = createAccountSchema.parse(req.body);
    
    const [account] = await db
      .insert(schema.emailAccounts)
      .values({
        consultantId,
        provider: "imap",
        ...validated,
      })
      .returning();
    
    res.status(201).json({
      success: true,
      data: { ...account, imapPassword: undefined, smtpPassword: undefined },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "An account with this email address already exists",
      });
    }
    console.error("[EMAIL-HUB] Error creating account:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/accounts/:id", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    const validated = updateAccountSchema.parse(req.body);
    
    const [updated] = await db
      .update(schema.emailAccounts)
      .set({ ...validated, updatedAt: new Date() })
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      )
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    
    res.json({
      success: true,
      data: { ...updated, imapPassword: undefined, smtpPassword: undefined },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }
    console.error("[EMAIL-HUB] Error updating account:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/accounts/import-preview", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const existingSmtpSettings = await db
      .select()
      .from(schema.consultantSmtpSettings)
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    
    if (!existingSmtpSettings.length) {
      return res.json({ 
        success: true, 
        data: { 
          available: false, 
          message: "Nessuna configurazione email esistente trovata" 
        } 
      });
    }
    
    const existingAccounts = await db
      .select({ emailAddress: schema.emailAccounts.emailAddress })
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, consultantId));
    
    const existingEmails = new Set(existingAccounts.map(a => a.emailAddress.toLowerCase()));
    
    const importableSettings = existingSmtpSettings.filter(
      s => !existingEmails.has(s.fromEmail.toLowerCase())
    );
    
    res.json({
      success: true,
      data: {
        available: importableSettings.length > 0,
        total: existingSmtpSettings.length,
        importable: importableSettings.length,
        alreadyImported: existingSmtpSettings.length - importableSettings.length,
        settings: importableSettings.map(s => {
          const classification = classifyEmailProvider(s.smtpHost);
          return {
            id: s.id,
            fromEmail: s.fromEmail,
            fromName: s.fromName,
            smtpHost: s.smtpHost,
            smtpPort: s.smtpPort,
            smtpUser: s.smtpUser,
            smtpPassword: s.smtpPassword,
            accountReference: s.accountReference,
            provider: classification,
          };
        }),
        italianProviders: ITALIAN_PROVIDERS,
      },
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error checking import preview:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts/import", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const existingSmtpSettings = await db
      .select()
      .from(schema.consultantSmtpSettings)
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    
    if (!existingSmtpSettings.length) {
      return res.status(404).json({ 
        success: false, 
        error: "Nessuna configurazione email esistente trovata" 
      });
    }
    
    const existingAccounts = await db
      .select({ emailAddress: schema.emailAccounts.emailAddress })
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, consultantId));
    
    const existingEmails = new Set(existingAccounts.map(a => a.emailAddress.toLowerCase()));
    
    const settingsToImport = existingSmtpSettings.filter(
      s => !existingEmails.has(s.fromEmail.toLowerCase())
    );
    
    if (!settingsToImport.length) {
      return res.json({ 
        success: true, 
        data: { imported: 0, message: "Tutte le configurazioni sono già state importate" }
      });
    }
    
    const guessImapFromSmtp = (smtpHost: string): { host: string; port: number } => {
      const hostLower = smtpHost.toLowerCase();
      if (hostLower.includes("gmail") || hostLower.includes("google")) {
        return { host: "imap.gmail.com", port: 993 };
      }
      if (hostLower.includes("outlook") || hostLower.includes("office365") || hostLower.includes("microsoft")) {
        return { host: "outlook.office365.com", port: 993 };
      }
      if (hostLower.includes("yahoo")) {
        return { host: "imap.mail.yahoo.com", port: 993 };
      }
      return { host: smtpHost.replace(/^smtp\./, "imap."), port: 993 };
    };
    
    const mapTone = (tone: string | null): "formal" | "friendly" | "professional" => {
      switch (tone) {
        case "formale": return "formal";
        case "amichevole": return "friendly";
        case "professionale":
        case "motivazionale": return "professional";
        default: return "formal";
      }
    };
    
    const importedAccounts = [];
    
    for (const settings of settingsToImport) {
      const imap = guessImapFromSmtp(settings.smtpHost);
      
      try {
        const [account] = await db
          .insert(schema.emailAccounts)
          .values({
            consultantId,
            provider: "imap",
            displayName: settings.fromName || settings.fromEmail.split("@")[0],
            emailAddress: settings.fromEmail,
            imapHost: imap.host,
            imapPort: imap.port,
            imapUser: settings.smtpUser,
            imapPassword: settings.smtpPassword,
            imapTls: true,
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPassword: settings.smtpPassword,
            smtpTls: settings.smtpSecure,
            aiTone: mapTone(settings.emailTone),
            signature: settings.emailSignature,
            autoReplyMode: "review",
            confidenceThreshold: 0.8,
            syncStatus: "idle",
          })
          .returning();
        
        importedAccounts.push({
          id: account.id,
          emailAddress: account.emailAddress,
          displayName: account.displayName,
        });
      } catch (err: any) {
        console.error(`[EMAIL-HUB] Error importing ${settings.fromEmail}:`, err);
      }
    }
    
    res.json({
      success: true,
      data: {
        imported: importedAccounts.length,
        accounts: importedAccounts,
        message: `${importedAccounts.length} account importati con successo`,
      },
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error importing accounts:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import with wizard - supports hybrid configurations
router.post("/accounts/import-wizard", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    
    const importSchema = z.object({
      accounts: z.array(z.object({
        smtpSettingId: z.string(),
        accountType: z.enum(["smtp_only", "imap_only", "full", "hybrid"]),
        // IMAP override for hybrid configs
        imapHost: z.string().optional(),
        imapPort: z.number().default(993).optional(),
        imapUser: z.string().optional(),
        imapPassword: z.string().optional(),
      }))
    });
    
    const { accounts } = importSchema.parse(req.body);
    
    // Fetch original SMTP settings
    const existingSmtpSettings = await db
      .select()
      .from(schema.consultantSmtpSettings)
      .where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
    
    const settingsMap = new Map(existingSmtpSettings.map(s => [s.id.toString(), s]));
    
    // Check for already imported
    const existingAccounts = await db
      .select({ emailAddress: schema.emailAccounts.emailAddress })
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, consultantId));
    
    const existingEmails = new Set(existingAccounts.map(a => a.emailAddress.toLowerCase()));
    
    const mapTone = (tone: string | null): "formal" | "friendly" | "professional" => {
      switch (tone) {
        case "formale": return "formal";
        case "amichevole": return "friendly";
        case "professionale":
        case "motivazionale": return "professional";
        default: return "formal";
      }
    };
    
    const results: Array<{ success?: boolean; id?: string; emailAddress?: string; accountType?: string; error?: string; skipped?: boolean }> = [];
    
    for (const accountConfig of accounts) {
      const settings = settingsMap.get(accountConfig.smtpSettingId);
      if (!settings) {
        results.push({ error: `Setting ${accountConfig.smtpSettingId} not found` });
        continue;
      }
      
      if (existingEmails.has(settings.fromEmail.toLowerCase())) {
        results.push({ error: `${settings.fromEmail} already imported`, skipped: true });
        continue;
      }
      
      try {
        const accountData: any = {
          consultantId,
          provider: "imap",
          accountType: accountConfig.accountType,
          displayName: settings.fromName || settings.fromEmail.split("@")[0],
          emailAddress: settings.fromEmail,
          aiTone: mapTone(settings.emailTone),
          signature: settings.emailSignature,
          autoReplyMode: "review",
          confidenceThreshold: 0.8,
          syncStatus: "idle",
        };
        
        // Add SMTP if not imap_only
        if (accountConfig.accountType !== "imap_only") {
          accountData.smtpHost = settings.smtpHost;
          accountData.smtpPort = settings.smtpPort;
          accountData.smtpUser = settings.smtpUser;
          accountData.smtpPassword = settings.smtpPassword;
          accountData.smtpTls = settings.smtpSecure;
        }
        
        // Add IMAP if not smtp_only
        if (accountConfig.accountType !== "smtp_only") {
          // Use provided IMAP or guess from SMTP
          if (accountConfig.imapHost) {
            accountData.imapHost = accountConfig.imapHost;
            accountData.imapPort = accountConfig.imapPort || 993;
            accountData.imapUser = accountConfig.imapUser || settings.smtpUser;
            accountData.imapPassword = accountConfig.imapPassword || settings.smtpPassword;
          } else {
            // Try to guess (only for full-service providers)
            const classification = classifyEmailProvider(settings.smtpHost);
            if (classification.suggestedImapHost) {
              accountData.imapHost = classification.suggestedImapHost;
              accountData.imapPort = classification.suggestedImapPort || 993;
              accountData.imapUser = settings.smtpUser;
              accountData.imapPassword = settings.smtpPassword;
            }
          }
          accountData.imapTls = true;
        }
        
        const [account] = await db
          .insert(schema.emailAccounts)
          .values(accountData)
          .returning();
        
        results.push({
          success: true,
          id: account.id,
          emailAddress: account.emailAddress,
          accountType: account.accountType || "full",
        });
        
        existingEmails.add(settings.fromEmail.toLowerCase());
      } catch (err: any) {
        console.error(`[EMAIL-HUB] Error importing ${settings.fromEmail}:`, err);
        results.push({ error: err.message, emailAddress: settings.fromEmail });
      }
    }
    
    const imported = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        imported,
        total: accounts.length,
        results,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }
    console.error("[EMAIL-HUB] Error in wizard import:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/accounts/:id", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    
    const [deleted] = await db
      .delete(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      )
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error deleting account:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts/test", async (req: AuthRequest, res) => {
  try {
    const { imapHost, imapPort, imapUser, imapPassword, imapTls,
            smtpHost, smtpPort, smtpUser, smtpPassword, smtpTls } = req.body;
    
    console.log(`[EMAIL-HUB TEST] Testing credentials directly (no account ID)`);
    console.log(`[EMAIL-HUB TEST] IMAP config: host=${imapHost}, port=${imapPort}, user=${imapUser ? '***' : 'null'}`);
    console.log(`[EMAIL-HUB TEST] SMTP config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser ? '***' : 'null'}`);
    
    let imapResult: { success: boolean; message: string } = { success: true, message: "IMAP non configurato" };
    let smtpResult: { success: boolean; message: string } = { success: true, message: "SMTP non configurato" };
    
    const hasImap = imapHost && imapPort && imapUser && imapPassword;
    const hasSmtp = smtpHost && smtpPort && smtpUser && smtpPassword;
    
    console.log(`[EMAIL-HUB TEST] Has IMAP: ${!!hasImap}, Has SMTP: ${!!hasSmtp}`);
    
    if (hasImap) {
      console.log(`[EMAIL-HUB TEST] Testing IMAP connection to ${imapHost}:${imapPort}...`);
      const imapService = createImapService({
        host: imapHost,
        port: parseInt(imapPort, 10),
        user: imapUser,
        password: imapPassword,
        tls: imapTls ?? true,
      });
      try {
        imapResult = await imapService.testConnection();
        console.log(`[EMAIL-HUB TEST] IMAP result:`, imapResult);
      } catch (imapError: any) {
        console.error(`[EMAIL-HUB TEST] IMAP error:`, imapError);
        imapResult = { success: false, message: imapError.message || "Errore IMAP sconosciuto" };
      }
    }
    
    if (hasSmtp) {
      console.log(`[EMAIL-HUB TEST] Testing SMTP connection to ${smtpHost}:${smtpPort}...`);
      const smtpService = createSmtpService({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        user: smtpUser,
        password: smtpPassword,
        tls: smtpTls ?? true,
      });
      try {
        smtpResult = await smtpService.testConnection();
        console.log(`[EMAIL-HUB TEST] SMTP result:`, smtpResult);
      } catch (smtpError: any) {
        console.error(`[EMAIL-HUB TEST] SMTP error:`, smtpError);
        smtpResult = { success: false, message: smtpError.message || "Errore SMTP sconosciuto" };
      }
    }
    
    console.log(`[EMAIL-HUB TEST] Final results - IMAP: ${imapResult.success}, SMTP: ${smtpResult.success}`);
    
    res.json({
      success: true,
      data: {
        imap: imapResult,
        smtp: smtpResult,
      },
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB TEST] Error testing connection:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts/:id/test", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    
    console.log(`[EMAIL-HUB TEST] Starting test for account ${accountId}`);
    
    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );
    
    if (!account) {
      console.log(`[EMAIL-HUB TEST] Account not found: ${accountId}`);
      return res.status(404).json({ success: false, error: "Account not found" });
    }
    
    console.log(`[EMAIL-HUB TEST] Account found: ${account.email}`);
    console.log(`[EMAIL-HUB TEST] Account type: ${account.accountType}`);
    console.log(`[EMAIL-HUB TEST] IMAP config: host=${account.imapHost}, port=${account.imapPort}, user=${account.imapUser ? '***' : 'null'}`);
    console.log(`[EMAIL-HUB TEST] SMTP config: host=${account.smtpHost}, port=${account.smtpPort}, user=${account.smtpUser ? '***' : 'null'}`);
    
    let imapResult: { success: boolean; message: string } = { success: true, message: "IMAP non configurato" };
    let smtpResult: { success: boolean; message: string } = { success: true, message: "SMTP non configurato" };
    
    const hasImap = account.imapHost && account.imapPort && account.imapUser && account.imapPassword;
    const hasSmtp = account.smtpHost && account.smtpPort && account.smtpUser && account.smtpPassword;
    
    console.log(`[EMAIL-HUB TEST] Has IMAP: ${hasImap ? 'YES' : 'NO'}, Has SMTP: ${hasSmtp ? 'YES' : 'NO'}`);
    
    if (hasImap) {
      console.log(`[EMAIL-HUB TEST] Testing IMAP connection to ${account.imapHost}:${account.imapPort}...`);
      const imapService = createImapService({
        host: account.imapHost!,
        port: account.imapPort!,
        user: account.imapUser!,
        password: account.imapPassword!,
        tls: account.imapTls ?? true,
      });
      try {
        imapResult = await imapService.testConnection();
        console.log(`[EMAIL-HUB TEST] IMAP result:`, imapResult);
      } catch (imapError: any) {
        console.error(`[EMAIL-HUB TEST] IMAP error:`, imapError);
        imapResult = { success: false, message: imapError.message || "Errore IMAP sconosciuto" };
      }
    }
    
    if (hasSmtp) {
      console.log(`[EMAIL-HUB TEST] Testing SMTP connection to ${account.smtpHost}:${account.smtpPort}...`);
      const smtpService = createSmtpService({
        host: account.smtpHost!,
        port: account.smtpPort!,
        user: account.smtpUser!,
        password: account.smtpPassword!,
        tls: account.smtpTls ?? true,
      });
      try {
        smtpResult = await smtpService.testConnection();
        console.log(`[EMAIL-HUB TEST] SMTP result:`, smtpResult);
      } catch (smtpError: any) {
        console.error(`[EMAIL-HUB TEST] SMTP error:`, smtpError);
        smtpResult = { success: false, message: smtpError.message || "Errore SMTP sconosciuto" };
      }
    }
    
    console.log(`[EMAIL-HUB TEST] Final results - IMAP: ${imapResult.success}, SMTP: ${smtpResult.success}`);
    
    res.json({
      success: true,
      data: {
        imap: imapResult,
        smtp: smtpResult,
      },
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB TEST] Error testing connection:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/inbox", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { accountId, status, starred, unread, limit = "50", offset = "0" } = req.query;
    
    const conditions = [eq(schema.hubEmails.consultantId, consultantId)];
    
    if (accountId && typeof accountId === "string") {
      conditions.push(eq(schema.hubEmails.accountId, accountId));
    }
    
    if (status && typeof status === "string") {
      conditions.push(eq(schema.hubEmails.processingStatus, status as any));
    }
    
    if (starred === "true") {
      conditions.push(eq(schema.hubEmails.isStarred, true));
    }
    
    if (unread === "true") {
      conditions.push(eq(schema.hubEmails.isRead, false));
    }
    
    const emails = await db
      .select()
      .from(schema.hubEmails)
      .where(and(...conditions))
      .orderBy(desc(schema.hubEmails.receivedAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));
    
    res.json({ success: true, data: emails, count: emails.length });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error fetching inbox:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/emails/:id", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const emailId = req.params.id;
    
    const [email] = await db
      .select()
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      );
    
    if (!email) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    
    res.json({ success: true, data: email });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error fetching email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/emails/:id/read", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const emailId = req.params.id;
    
    const [updated] = await db
      .update(schema.hubEmails)
      .set({ isRead: true, updatedAt: new Date() })
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      )
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error marking email as read:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/emails/:id/star", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const emailId = req.params.id;
    
    const [email] = await db
      .select()
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      );
    
    if (!email) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    
    const [updated] = await db
      .update(schema.hubEmails)
      .set({ isStarred: !email.isStarred, updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId))
      .returning();
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error toggling star:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/emails/:id/ai-responses", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const emailId = req.params.id;
    
    const [email] = await db
      .select()
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      );
    
    if (!email) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    
    const responses = await db
      .select()
      .from(schema.emailHubAiResponses)
      .where(eq(schema.emailHubAiResponses.emailId, emailId))
      .orderBy(desc(schema.emailHubAiResponses.createdAt));
    
    res.json({ success: true, data: responses });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error fetching AI responses:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/emails/:id/ai-responses", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const emailId = req.params.id;
    
    const [email] = await db
      .select()
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      );
    
    if (!email) {
      return res.status(404).json({ success: false, error: "Email not found" });
    }
    
    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, email.accountId));
    
    if (!account) {
      return res.status(404).json({ success: false, error: "Email account not found" });
    }
    
    const accountSettings = {
      aiTone: (account.aiTone as "formal" | "friendly" | "professional") || "professional",
      signature: account.signature,
      confidenceThreshold: account.confidenceThreshold || 0.8,
    };
    
    const originalEmail = {
      subject: email.subject,
      fromName: email.fromName,
      fromEmail: email.fromEmail,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
    };
    
    const draft = await generateEmailDraft(
      emailId,
      originalEmail,
      accountSettings,
      consultantId
    );
    
    const classification = await classifyEmail(emailId, consultantId);
    
    const [response] = await db
      .insert(schema.emailHubAiResponses)
      .values({
        emailId,
        draftSubject: draft.subject,
        draftBodyHtml: draft.bodyHtml,
        draftBodyText: draft.bodyText,
        confidence: draft.confidence,
        modelUsed: draft.modelUsed,
        tokensUsed: draft.tokensUsed,
        reasoning: classification as any,
        status: "draft",
      })
      .returning();
    
    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "draft_generated", updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId));
    
    res.status(201).json({ success: true, data: response, classification });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error generating AI response:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ai-responses/:id/approve", async (req: AuthRequest, res) => {
  try {
    const responseId = req.params.id;
    
    const [updated] = await db
      .update(schema.emailHubAiResponses)
      .set({ status: "approved", reviewedAt: new Date() })
      .where(eq(schema.emailHubAiResponses.id, responseId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "AI response not found" });
    }
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error approving AI response:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ai-responses/:id/edit", async (req: AuthRequest, res) => {
  try {
    const responseId = req.params.id;
    const userId = req.user!.id;
    
    const editSchema = z.object({
      draftSubject: z.string().optional(),
      draftBodyHtml: z.string().optional(),
      draftBodyText: z.string().optional(),
      editNotes: z.string().optional(),
    });
    
    const validated = editSchema.parse(req.body);
    
    const [existing] = await db
      .select()
      .from(schema.emailHubAiResponses)
      .where(eq(schema.emailHubAiResponses.id, responseId));
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "AI response not found" });
    }
    
    const [updated] = await db
      .update(schema.emailHubAiResponses)
      .set({
        ...validated,
        status: "edited",
        originalDraft: existing.originalDraft || existing.draftBodyHtml,
        editedBy: userId,
        reviewedAt: new Date(),
      })
      .where(eq(schema.emailHubAiResponses.id, responseId))
      .returning();
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }
    console.error("[EMAIL-HUB] Error editing AI response:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/ai-responses/:id/reject", async (req: AuthRequest, res) => {
  try {
    const responseId = req.params.id;
    
    const [updated] = await db
      .update(schema.emailHubAiResponses)
      .set({ status: "rejected", reviewedAt: new Date() })
      .where(eq(schema.emailHubAiResponses.id, responseId))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "AI response not found" });
    }
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error rejecting AI response:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ai-responses/:id/send", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const responseId = req.params.id;
    
    const [response] = await db
      .select()
      .from(schema.emailHubAiResponses)
      .where(eq(schema.emailHubAiResponses.id, responseId));
    
    if (!response) {
      return res.status(404).json({ success: false, error: "AI response not found" });
    }
    
    if (!["approved", "edited"].includes(response.status)) {
      return res.status(400).json({
        success: false,
        error: "Only approved or edited responses can be sent",
      });
    }
    
    const [email] = await db
      .select()
      .from(schema.hubEmails)
      .where(eq(schema.hubEmails.id, response.emailId));
    
    if (!email) {
      return res.status(404).json({ success: false, error: "Original email not found" });
    }
    
    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, email.accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );
    
    if (!account) {
      return res.status(404).json({ success: false, error: "Email account not found" });
    }
    
    const smtpService = createSmtpService({
      host: account.smtpHost!,
      port: account.smtpPort!,
      user: account.smtpUser!,
      password: account.smtpPassword!,
      tls: account.smtpTls ?? true,
    });
    
    const sendResult = await smtpService.sendEmail({
      from: account.emailAddress,
      fromName: account.displayName || undefined,
      to: email.fromEmail,
      subject: response.draftSubject || `Re: ${email.subject}`,
      html: response.draftBodyHtml || undefined,
      text: response.draftBodyText || undefined,
      inReplyTo: email.messageId,
      references: email.messageId,
    });
    
    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to send email: ${sendResult.error}`,
      });
    }
    
    await db
      .update(schema.emailHubAiResponses)
      .set({ status: "sent", sentAt: new Date() })
      .where(eq(schema.emailHubAiResponses.id, responseId));
    
    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "sent", updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, email.id));
    
    res.json({
      success: true,
      message: "Email sent successfully",
      messageId: sendResult.messageId,
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error sending email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function saveEmailToDatabase(email: ParsedEmail, accountId: string, consultantId: string): Promise<void> {
  const existingEmail = await db
    .select()
    .from(schema.hubEmails)
    .where(eq(schema.hubEmails.messageId, email.messageId))
    .limit(1);

  if (existingEmail.length > 0) {
    console.log(`[IMAP IDLE] Email already exists: ${email.messageId}`);
    return;
  }

  await db.insert(schema.hubEmails).values({
    accountId,
    consultantId,
    messageId: email.messageId,
    subject: email.subject,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    toRecipients: email.toRecipients,
    ccRecipients: email.ccRecipients,
    bodyHtml: email.bodyHtml,
    bodyText: email.bodyText,
    snippet: email.snippet,
    direction: "inbound",
    isRead: false,
    receivedAt: email.receivedAt,
    attachments: email.attachments,
    hasAttachments: email.hasAttachments,
    inReplyTo: email.inReplyTo,
    processingStatus: "new",
  });

  console.log(`[IMAP IDLE] Saved new email: ${email.subject}`);
}

router.post("/accounts/:id/sync", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    const { limit = 50 } = req.body;

    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );

    if (!account) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }

    if (!account.imapPassword || !account.imapHost || !account.imapUser) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing IMAP credentials. Please update the account with valid IMAP settings." 
      });
    }

    console.log(`[EMAIL-HUB SYNC] Starting sync for ${account.emailAddress}...`);

    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "syncing" })
      .where(eq(schema.emailAccounts.id, accountId));

    const imapService = createImapService({
      host: account.imapHost,
      port: account.imapPort || 993,
      user: account.imapUser,
      password: account.imapPassword,
      tls: account.imapTls ?? true,
    });

    try {
      const emails = await imapService.fetchRecentEmails(limit);
      console.log(`[EMAIL-HUB SYNC] Fetched ${emails.length} emails from IMAP`);

      let imported = 0;
      let duplicates = 0;

      for (const email of emails) {
        const existingEmail = await db
          .select({ id: schema.hubEmails.id })
          .from(schema.hubEmails)
          .where(
            and(
              eq(schema.hubEmails.accountId, accountId),
              eq(schema.hubEmails.messageId, email.messageId)
            )
          )
          .limit(1);

        if (existingEmail.length > 0) {
          duplicates++;
          continue;
        }

        await db.insert(schema.hubEmails).values({
          accountId,
          consultantId,
          messageId: email.messageId,
          subject: email.subject,
          fromName: email.fromName,
          fromEmail: email.fromEmail,
          toRecipients: email.toRecipients,
          ccRecipients: email.ccRecipients,
          bodyHtml: email.bodyHtml,
          bodyText: email.bodyText,
          snippet: email.snippet,
          direction: "inbound",
          isRead: false,
          receivedAt: email.receivedAt,
          attachments: email.attachments,
          hasAttachments: email.hasAttachments,
          inReplyTo: email.inReplyTo,
          processingStatus: "new",
        });
        imported++;
      }

      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "idle", syncError: null, lastSyncAt: new Date() })
        .where(eq(schema.emailAccounts.id, accountId));

      console.log(`[EMAIL-HUB SYNC] Completed: ${imported} imported, ${duplicates} duplicates`);

      res.json({ 
        success: true, 
        data: { 
          imported, 
          duplicates, 
          total: emails.length 
        } 
      });
    } catch (syncError: any) {
      console.error(`[EMAIL-HUB SYNC] Error:`, syncError);
      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "error", syncError: syncError.message })
        .where(eq(schema.emailAccounts.id, accountId));
      throw syncError;
    }
  } catch (error: any) {
    console.error("[EMAIL-HUB SYNC] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts/:id/idle/start", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;

    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );

    if (!account) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }

    if (!account.imapPassword || !account.imapHost || !account.imapUser) {
      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "error", syncError: "Missing IMAP credentials" })
        .where(eq(schema.emailAccounts.id, accountId));
      return res.status(400).json({ 
        success: false, 
        error: "Missing IMAP credentials. Please update the account with valid IMAP settings." 
      });
    }

    const idleManager = ImapIdleManager.getInstance();

    if (idleManager.isConnected(accountId)) {
      return res.json({ success: true, message: "IDLE already active" });
    }

    console.log(`[IMAP IDLE] Starting connection for ${account.emailAddress} at ${account.imapHost}:${account.imapPort}`);

    const started = await idleManager.startIdleForAccount({
      host: account.imapHost,
      port: account.imapPort || 993,
      user: account.imapUser,
      password: account.imapPassword,
      tls: account.imapTls ?? true,
      accountId,
      consultantId,
      onNewEmail: async (email) => {
        await saveEmailToDatabase(email, accountId, consultantId);
      },
      onError: async (error) => {
        console.error(`[IMAP IDLE] Error for account ${accountId}:`, error.message);
        await db
          .update(schema.emailAccounts)
          .set({ syncStatus: "error", syncError: error.message })
          .where(eq(schema.emailAccounts.id, accountId));
      },
      onDisconnect: async () => {
        console.log(`[IMAP IDLE] Disconnected from account ${accountId}`);
        await db
          .update(schema.emailAccounts)
          .set({ syncStatus: "idle" })
          .where(eq(schema.emailAccounts.id, accountId));
      },
    });

    if (started) {
      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "connected", syncError: null, lastSyncAt: new Date() })
        .where(eq(schema.emailAccounts.id, accountId));

      res.json({ success: true, message: "IDLE started successfully" });
    } else {
      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "error", syncError: "Failed to connect" })
        .where(eq(schema.emailAccounts.id, accountId));
      res.status(500).json({ success: false, error: "Failed to start IDLE connection" });
    }
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error starting IDLE:", error);
    const accountId = req.params.id;
    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "error", syncError: error.message })
      .where(eq(schema.emailAccounts.id, accountId));
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/accounts/:id/idle/stop", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;

    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );

    if (!account) {
      return res.status(404).json({ success: false, error: "Account not found" });
    }

    const idleManager = ImapIdleManager.getInstance();
    idleManager.stopIdleForAccount(accountId);

    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "idle" })
      .where(eq(schema.emailAccounts.id, accountId));

    res.json({ success: true, message: "IDLE stopped successfully" });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error stopping IDLE:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/idle/status", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;

    const accounts = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.consultantId, consultantId));

    const idleManager = ImapIdleManager.getInstance();
    const activeConnections = idleManager.getActiveConnections();

    const status = accounts.map((acc) => ({
      accountId: acc.id,
      displayName: acc.displayName,
      emailAddress: acc.emailAddress,
      isIdleActive: activeConnections.includes(acc.id),
      syncStatus: acc.syncStatus,
      lastSyncAt: acc.lastSyncAt,
    }));

    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error getting IDLE status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
