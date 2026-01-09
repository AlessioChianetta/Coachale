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

// Handle IDLE connection failures - update database when connection permanently fails
const idleManager = ImapIdleManager.getInstance();
idleManager.on("connectionFailed", async (accountId: string) => {
  console.log(`[EMAIL-HUB] Updating syncStatus to 'error' for account ${accountId} after IDLE failure`);
  try {
    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "error" })
      .where(eq(schema.emailAccounts.id, accountId));
  } catch (err) {
    console.error(`[EMAIL-HUB] Failed to update syncStatus for account ${accountId}:`, err);
  }
});

// Helper function to start IDLE and initial sync for an account (runs in background)
async function startIdleAndSyncInBackground(account: {
  id: string;
  consultantId: string;
  emailAddress: string;
  imapHost: string | null;
  imapPort: number | null;
  imapUser: string | null;
  imapPassword: string | null;
  imapTls: boolean | null;
  inboxFolderPath?: string | null;
  sentFolderPath?: string | null;
  draftsFolderPath?: string | null;
  trashFolderPath?: string | null;
}) {
  if (!account.imapHost || !account.imapUser || !account.imapPassword) {
    console.log(`[EMAIL-HUB AUTO] Skipping auto-sync for ${account.emailAddress} - no IMAP config`);
    return;
  }

  console.log(`[EMAIL-HUB AUTO] Starting automatic sync for ${account.emailAddress}...`);

  try {
    const imapService = createImapService({
      host: account.imapHost,
      port: account.imapPort || 993,
      user: account.imapUser,
      password: account.imapPassword,
      tls: account.imapTls ?? true,
    });

    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "syncing" })
      .where(eq(schema.emailAccounts.id, account.id));

    // Step 1: Discover folders if any are missing
    let inboxFolder = account.inboxFolderPath;
    let sentFolder = account.sentFolderPath;
    let draftsFolder = account.draftsFolderPath;
    
    if (!inboxFolder || !sentFolder || !draftsFolder) {
      console.log(`[EMAIL-HUB AUTO] Discovering folders for ${account.emailAddress}...`);
      try {
        const discovered = await imapService.listMailboxes();
        
        // Save discovered folders to database
        await db
          .update(schema.emailAccounts)
          .set({
            inboxFolderPath: discovered.inbox || "INBOX",
            sentFolderPath: discovered.sent,
            draftsFolderPath: discovered.drafts,
            trashFolderPath: discovered.trash,
            junkFolderPath: discovered.junk,
            archiveFolderPath: discovered.archive,
            discoveredFoldersAt: new Date(),
          })
          .where(eq(schema.emailAccounts.id, account.id));
        
        inboxFolder = discovered.inbox || "INBOX";
        sentFolder = discovered.sent;
        draftsFolder = discovered.drafts;
        
        console.log(`[EMAIL-HUB AUTO] Discovered: inbox=${inboxFolder}, sent=${sentFolder}, drafts=${draftsFolder}`);
      } catch (discoverErr: any) {
        console.error(`[EMAIL-HUB AUTO] Failed to discover folders:`, discoverErr.message);
      }
    }

    // Step 2: Build folder list to sync using discovered paths
    const foldersToSync: { path: string; type: "inbox" | "sent" | "drafts" }[] = [
      { path: inboxFolder || "INBOX", type: "inbox" },
    ];
    
    if (sentFolder) {
      foldersToSync.push({ path: sentFolder, type: "sent" });
    }
    if (draftsFolder) {
      foldersToSync.push({ path: draftsFolder, type: "drafts" });
    }

    let totalImported = 0;

    for (const folderInfo of foldersToSync) {
      try {
        const emails = await imapService.fetchRecentEmailsFromFolder(folderInfo.path, 50);
        console.log(`[EMAIL-HUB AUTO] Fetched ${emails.length} emails from ${folderInfo.path} (${folderInfo.type})`);

        for (const email of emails) {
          const existingEmail = await db
            .select({ id: schema.hubEmails.id })
            .from(schema.hubEmails)
            .where(
              and(
                eq(schema.hubEmails.accountId, account.id),
                eq(schema.hubEmails.messageId, email.messageId)
              )
            )
            .limit(1);

          if (existingEmail.length === 0) {
            const isSent = folderInfo.type === "sent";
            const isDrafts = folderInfo.type === "drafts";
            await db.insert(schema.hubEmails).values({
              accountId: account.id,
              consultantId: account.consultantId,
              messageId: email.messageId,
              subject: email.subject,
              fromName: email.fromName,
              fromEmail: email.fromEmail,
              toRecipients: email.toRecipients,
              ccRecipients: email.ccRecipients,
              bodyHtml: email.bodyHtml,
              bodyText: email.bodyText,
              snippet: email.snippet,
              direction: isSent ? "outbound" : "inbound",
              folder: folderInfo.type,
              isRead: isSent || isDrafts,
              receivedAt: email.receivedAt,
              attachments: email.attachments,
              hasAttachments: email.hasAttachments,
              inReplyTo: email.inReplyTo,
              processingStatus: isSent ? "processed" : "new",
            });
            totalImported++;
          }
        }
      } catch (folderErr: any) {
        console.log(`[EMAIL-HUB AUTO] Could not sync folder ${folderInfo.path}: ${folderErr.message}`);
      }
    }

    console.log(`[EMAIL-HUB AUTO] Initial sync complete: ${totalImported} emails imported`);

    // Now start IDLE for live updates
    const idleManager = ImapIdleManager.getInstance();
    
    if (!idleManager.isConnected(account.id)) {
      const started = await idleManager.startIdleForAccount({
        host: account.imapHost,
        port: account.imapPort || 993,
        user: account.imapUser,
        password: account.imapPassword,
        tls: account.imapTls ?? true,
        accountId: account.id,
        consultantId: account.consultantId,
        onNewEmail: async (email) => {
          await saveEmailToDatabase(email, account.id, account.consultantId);
        },
        onError: async (error) => {
          console.error(`[IMAP IDLE] Error for account ${account.id}:`, error.message);
          await db
            .update(schema.emailAccounts)
            .set({ syncStatus: "error", syncError: error.message })
            .where(eq(schema.emailAccounts.id, account.id));
        },
        onDisconnect: async () => {
          console.log(`[IMAP IDLE] Disconnected from account ${account.id}`);
          await db
            .update(schema.emailAccounts)
            .set({ syncStatus: "idle" })
            .where(eq(schema.emailAccounts.id, account.id));
        },
      });

      if (started) {
        await db
          .update(schema.emailAccounts)
          .set({ syncStatus: "connected", syncError: null, lastSyncAt: new Date() })
          .where(eq(schema.emailAccounts.id, account.id));
        console.log(`[EMAIL-HUB AUTO] IDLE started for ${account.emailAddress}`);
      }
    }
  } catch (error: any) {
    console.error(`[EMAIL-HUB AUTO] Error during auto-sync for ${account.emailAddress}:`, error.message);
    await db
      .update(schema.emailAccounts)
      .set({ syncStatus: "error", syncError: error.message })
      .where(eq(schema.emailAccounts.id, account.id));
  }
}

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
    
    // Start automatic sync and IDLE in background (don't wait)
    if (validated.accountType !== "smtp_only") {
      startIdleAndSyncInBackground(account).catch(err => {
        console.error(`[EMAIL-HUB] Background sync failed for ${account.emailAddress}:`, err.message);
      });
    }
    
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
        
        // Start automatic sync and IDLE in background (don't wait)
        startIdleAndSyncInBackground(account).catch(err => {
          console.error(`[EMAIL-HUB] Background sync failed for ${account.emailAddress}:`, err.message);
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
        
        // Start automatic sync and IDLE in background (don't wait)
        if (accountConfig.accountType !== "smtp_only") {
          startIdleAndSyncInBackground(account).catch(err => {
            console.error(`[EMAIL-HUB] Background sync failed for ${account.emailAddress}:`, err.message);
          });
        }
        
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
    const { accountId, status, starred, unread, folder, direction, limit = "50", offset = "0" } = req.query;
    
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
    
    // Filter by folder (inbox, sent, drafts, etc.)
    if (folder && typeof folder === "string") {
      conditions.push(eq(schema.hubEmails.folder, folder));
    }
    
    // Filter by direction (inbound, outbound)
    if (direction && typeof direction === "string") {
      conditions.push(eq(schema.hubEmails.direction, direction as "inbound" | "outbound"));
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

// ============================================
// MANUAL EMAIL COMPOSITION ENDPOINTS
// ============================================

// Compose new email (not a reply)
router.post("/compose", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { accountId, to, cc, bcc, subject, bodyHtml, bodyText } = req.body;

    if (!accountId || !to || !subject) {
      return res.status(400).json({ 
        success: false, 
        error: "Account, destinatario e oggetto sono obbligatori" 
      });
    }

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
      return res.status(404).json({ success: false, error: "Account email non trovato" });
    }

    if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "SMTP non configurato per questo account" 
      });
    }

    const smtpService = createSmtpService({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      user: account.smtpUser,
      password: account.smtpPassword,
      tls: account.smtpTls ?? true,
    });

    const toArray = Array.isArray(to) ? to : [to];
    const ccArray = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    const sendResult = await smtpService.sendEmail({
      from: account.emailAddress,
      fromName: account.displayName || undefined,
      to: toArray,
      cc: ccArray.length > 0 ? ccArray : undefined,
      bcc: bccArray.length > 0 ? bccArray : undefined,
      subject,
      html: bodyHtml || undefined,
      text: bodyText || undefined,
    });

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: `Invio fallito: ${sendResult.error}`,
      });
    }

    const [savedEmail] = await db
      .insert(schema.hubEmails)
      .values({
        accountId,
        consultantId,
        messageId: sendResult.messageId || `manual-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        subject,
        fromName: account.displayName,
        fromEmail: account.emailAddress,
        toRecipients: toArray,
        ccRecipients: ccArray,
        bccRecipients: bccArray,
        bodyHtml,
        bodyText,
        snippet: bodyText?.substring(0, 200) || "",
        direction: "outbound",
        folder: "sent",
        isRead: true,
        sentAt: new Date(),
        processingStatus: "sent",
      })
      .returning();

    console.log(`[EMAIL-HUB] Composed and sent new email to ${toArray.join(", ")}`);

    res.json({
      success: true,
      message: "Email inviata con successo",
      data: savedEmail,
      messageId: sendResult.messageId,
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error composing email:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reply to an email directly (without AI draft)
router.post("/reply", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { emailId, bodyHtml, bodyText, replyAll } = req.body;

    if (!emailId || (!bodyHtml && !bodyText)) {
      return res.status(400).json({ 
        success: false, 
        error: "Email ID e contenuto sono obbligatori" 
      });
    }

    const [originalEmail] = await db
      .select()
      .from(schema.hubEmails)
      .where(
        and(
          eq(schema.hubEmails.id, emailId),
          eq(schema.hubEmails.consultantId, consultantId)
        )
      );

    if (!originalEmail) {
      return res.status(404).json({ success: false, error: "Email originale non trovata" });
    }

    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, originalEmail.accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );

    if (!account) {
      return res.status(404).json({ success: false, error: "Account email non trovato" });
    }

    if (!account.smtpHost || !account.smtpUser || !account.smtpPassword) {
      return res.status(400).json({ 
        success: false, 
        error: "SMTP non configurato per questo account" 
      });
    }

    const smtpService = createSmtpService({
      host: account.smtpHost,
      port: account.smtpPort || 587,
      user: account.smtpUser,
      password: account.smtpPassword,
      tls: account.smtpTls ?? true,
    });

    let toRecipients = [originalEmail.fromEmail];
    let ccRecipients: string[] = [];
    
    if (replyAll) {
      const originalTo = (originalEmail.toRecipients as string[]) || [];
      const originalCc = (originalEmail.ccRecipients as string[]) || [];
      
      toRecipients = [originalEmail.fromEmail, ...originalTo.filter(e => e !== account.emailAddress)];
      ccRecipients = originalCc.filter(e => e !== account.emailAddress);
    }

    const replySubject = originalEmail.subject?.startsWith("Re: ") 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject || "(Nessun oggetto)"}`;

    const sendResult = await smtpService.sendEmail({
      from: account.emailAddress,
      fromName: account.displayName || undefined,
      to: toRecipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject: replySubject,
      html: bodyHtml || undefined,
      text: bodyText || undefined,
      inReplyTo: originalEmail.messageId,
      references: originalEmail.messageId,
    });

    if (!sendResult.success) {
      return res.status(500).json({
        success: false,
        error: `Invio fallito: ${sendResult.error}`,
      });
    }

    const [savedReply] = await db
      .insert(schema.hubEmails)
      .values({
        accountId: originalEmail.accountId,
        consultantId,
        messageId: sendResult.messageId || `reply-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        threadId: originalEmail.threadId || originalEmail.messageId,
        inReplyTo: originalEmail.messageId,
        subject: replySubject,
        fromName: account.displayName,
        fromEmail: account.emailAddress,
        toRecipients,
        ccRecipients,
        bodyHtml,
        bodyText,
        snippet: bodyText?.substring(0, 200) || "",
        direction: "outbound",
        folder: "sent",
        isRead: true,
        sentAt: new Date(),
        processingStatus: "sent",
      })
      .returning();

    await db
      .update(schema.hubEmails)
      .set({ processingStatus: "sent", updatedAt: new Date() })
      .where(eq(schema.hubEmails.id, emailId));

    console.log(`[EMAIL-HUB] Sent reply to ${originalEmail.fromEmail}`);

    res.json({
      success: true,
      message: "Risposta inviata con successo",
      data: savedReply,
      messageId: sendResult.messageId,
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error sending reply:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AI SETTINGS ENDPOINTS
// ============================================

// Update AI settings for an account
router.put("/accounts/:id/ai-settings", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    const {
      aiTone,
      confidenceThreshold,
      autoReplyMode,
      signature,
      customInstructions,
      aiLanguage,
      escalationKeywords,
      stopOnRisk,
      bookingLink,
    } = req.body;

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
      return res.status(404).json({ success: false, error: "Account non trovato" });
    }

    const updateData: Partial<typeof schema.emailAccounts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (aiTone !== undefined) updateData.aiTone = aiTone;
    if (confidenceThreshold !== undefined) updateData.confidenceThreshold = confidenceThreshold;
    if (autoReplyMode !== undefined) updateData.autoReplyMode = autoReplyMode;
    if (signature !== undefined) updateData.signature = signature;
    if (customInstructions !== undefined) updateData.customInstructions = customInstructions;
    if (aiLanguage !== undefined) updateData.aiLanguage = aiLanguage;
    if (escalationKeywords !== undefined) updateData.escalationKeywords = escalationKeywords;
    if (stopOnRisk !== undefined) updateData.stopOnRisk = stopOnRisk;
    if (bookingLink !== undefined) updateData.bookingLink = bookingLink;

    const [updated] = await db
      .update(schema.emailAccounts)
      .set(updateData)
      .where(eq(schema.emailAccounts.id, accountId))
      .returning();

    console.log(`[EMAIL-HUB] Updated AI settings for account ${accountId}`);

    res.json({
      success: true,
      message: "Impostazioni AI aggiornate",
      data: updated,
    });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error updating AI settings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get AI settings for an account
router.get("/accounts/:id/ai-settings", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;

    const [account] = await db
      .select({
        id: schema.emailAccounts.id,
        aiTone: schema.emailAccounts.aiTone,
        confidenceThreshold: schema.emailAccounts.confidenceThreshold,
        autoReplyMode: schema.emailAccounts.autoReplyMode,
        signature: schema.emailAccounts.signature,
        customInstructions: schema.emailAccounts.customInstructions,
        aiLanguage: schema.emailAccounts.aiLanguage,
        escalationKeywords: schema.emailAccounts.escalationKeywords,
        stopOnRisk: schema.emailAccounts.stopOnRisk,
        bookingLink: schema.emailAccounts.bookingLink,
      })
      .from(schema.emailAccounts)
      .where(
        and(
          eq(schema.emailAccounts.id, accountId),
          eq(schema.emailAccounts.consultantId, consultantId)
        )
      );

    if (!account) {
      return res.status(404).json({ success: false, error: "Account non trovato" });
    }

    res.json({ success: true, data: account });
  } catch (error: any) {
    console.error("[EMAIL-HUB] Error fetching AI settings:", error);
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
      // Step 1: Discover folders if any are missing
      let inboxFolder = account.inboxFolderPath;
      let sentFolder = account.sentFolderPath;
      let draftsFolder = account.draftsFolderPath;
      
      if (!inboxFolder || !sentFolder || !draftsFolder) {
        console.log(`[EMAIL-HUB SYNC] Discovering folders for ${account.emailAddress}...`);
        try {
          const discovered = await imapService.listMailboxes();
          
          // Save discovered folders to database
          await db
            .update(schema.emailAccounts)
            .set({
              inboxFolderPath: discovered.inbox || "INBOX",
              sentFolderPath: discovered.sent,
              draftsFolderPath: discovered.drafts,
              trashFolderPath: discovered.trash,
              junkFolderPath: discovered.junk,
              archiveFolderPath: discovered.archive,
              discoveredFoldersAt: new Date(),
            })
            .where(eq(schema.emailAccounts.id, accountId));
          
          inboxFolder = discovered.inbox || "INBOX";
          sentFolder = discovered.sent;
          draftsFolder = discovered.drafts;
          
          console.log(`[EMAIL-HUB SYNC] Discovered: inbox=${inboxFolder}, sent=${sentFolder}, drafts=${draftsFolder}`);
        } catch (discoverErr: any) {
          console.error(`[EMAIL-HUB SYNC] Failed to discover folders:`, discoverErr.message);
        }
      }

      // Step 2: Build folder list using discovered paths
      const foldersToSync: { path: string; type: "inbox" | "sent" | "drafts" }[] = [
        { path: inboxFolder || "INBOX", type: "inbox" },
      ];
      
      if (sentFolder) {
        foldersToSync.push({ path: sentFolder, type: "sent" });
      }
      if (draftsFolder) {
        foldersToSync.push({ path: draftsFolder, type: "drafts" });
      }

      console.log(`[EMAIL-HUB SYNC] Syncing folders:`, foldersToSync.map(f => f.path).join(", "));

      let totalImported = 0;
      let totalDuplicates = 0;

      for (const folderInfo of foldersToSync) {
        try {
          const emails = await imapService.fetchRecentEmailsFromFolder(folderInfo.path, limit);
          console.log(`[EMAIL-HUB SYNC] Fetched ${emails.length} emails from ${folderInfo.path} (${folderInfo.type})`);

          const isSent = folderInfo.type === "sent";
          const isDrafts = folderInfo.type === "drafts";

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
              totalDuplicates++;
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
              direction: isSent ? "outbound" : "inbound",
              folder: folderInfo.type,
              isRead: isSent || isDrafts,
              receivedAt: email.receivedAt,
              attachments: email.attachments,
              hasAttachments: email.hasAttachments,
              inReplyTo: email.inReplyTo,
              processingStatus: isSent ? "processed" : "new",
            });
            totalImported++;
          }
        } catch (folderErr: any) {
          console.log(`[EMAIL-HUB SYNC] Could not sync folder ${folderInfo.path}: ${folderErr.message}`);
        }
      }

      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "idle", syncError: null, lastSyncAt: new Date() })
        .where(eq(schema.emailAccounts.id, accountId));

      console.log(`[EMAIL-HUB SYNC] Completed: ${totalImported} imported, ${totalDuplicates} duplicates`);

      res.json({ 
        success: true, 
        data: { 
          imported: totalImported, 
          duplicates: totalDuplicates, 
          total: totalImported + totalDuplicates 
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

// ============================================
// EMAIL IMPORT JOB ENDPOINTS
// ============================================

// Start a new import job for an account
router.post("/accounts/:id/import/start", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;
    const { batchSize = 100 } = req.body;

    // Verify account ownership
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

    // Check for existing running job
    const [existingJob] = await db
      .select()
      .from(schema.emailImportJobs)
      .where(
        and(
          eq(schema.emailImportJobs.accountId, accountId),
          or(
            eq(schema.emailImportJobs.status, "pending"),
            eq(schema.emailImportJobs.status, "running")
          )
        )
      );

    if (existingJob) {
      return res.status(400).json({ 
        success: false, 
        error: "An import job is already in progress for this account",
        jobId: existingJob.id 
      });
    }

    // Create IMAP service to discover folders and count emails
    if (!account.imapHost || !account.imapUser || !account.imapPassword) {
      return res.status(400).json({ success: false, error: "Account does not have IMAP configured" });
    }

    const imapService = createImapService({
      host: account.imapHost,
      port: account.imapPort || 993,
      user: account.imapUser,
      password: account.imapPassword,
      tls: account.imapTls ?? true,
    });

    // Discover folders and get message counts
    const discovered = await imapService.listMailboxes();
    const foldersToImport = [
      { path: discovered.inbox || "INBOX", type: "inbox" },
      ...(discovered.sent ? [{ path: discovered.sent, type: "sent" }] : []),
      ...(discovered.drafts ? [{ path: discovered.drafts, type: "drafts" }] : []),
    ];

    // Create import job
    const [job] = await db
      .insert(schema.emailImportJobs)
      .values({
        accountId,
        consultantId,
        status: "pending",
        totalFolders: foldersToImport.length,
        batchSize,
        folderProgress: Object.fromEntries(
          foldersToImport.map(f => [f.path, { totalMessages: 0, processedMessages: 0, lastUid: 0, status: "pending" }])
        ),
      })
      .returning();

    console.log(`[EMAIL-IMPORT] Created import job ${job.id} for account ${account.emailAddress}`);

    // Start the import worker in background
    startImportWorker(job.id, account, foldersToImport, batchSize);

    res.json({ 
      success: true, 
      data: { 
        jobId: job.id,
        folders: foldersToImport.map(f => f.path),
        batchSize 
      } 
    });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error starting import:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get import job status
router.get("/import/:jobId", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { jobId } = req.params;

    const [job] = await db
      .select()
      .from(schema.emailImportJobs)
      .where(
        and(
          eq(schema.emailImportJobs.id, jobId),
          eq(schema.emailImportJobs.consultantId, consultantId)
        )
      );

    if (!job) {
      return res.status(404).json({ success: false, error: "Import job not found" });
    }

    res.json({ success: true, data: job });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error getting job status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SSE endpoint for real-time progress updates
// Note: EventSource doesn't support custom headers, so we accept token from query string
router.get("/import/:jobId/progress", async (req: AuthRequest, res) => {
  try {
    const { jobId } = req.params;
    const { token } = req.query;
    
    // For SSE endpoints, we need to handle auth differently since EventSource can't send headers
    let consultantId: string;
    
    if (req.user?.id) {
      // Standard auth worked (e.g., from cookie)
      consultantId = req.user.id;
    } else if (typeof token === "string" && token) {
      // Verify token from query string
      const jwt = require("jsonwebtoken");
      const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "your-secret-key";
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        consultantId = decoded.userId || decoded.id;
        if (!consultantId) {
          return res.status(401).json({ success: false, error: "Invalid token" });
        }
      } catch (jwtErr) {
        console.error("[EMAIL-IMPORT] JWT verification failed:", jwtErr);
        return res.status(401).json({ success: false, error: "Token expired or invalid" });
      }
    } else {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    // Verify job ownership
    const [job] = await db
      .select()
      .from(schema.emailImportJobs)
      .where(
        and(
          eq(schema.emailImportJobs.id, jobId),
          eq(schema.emailImportJobs.consultantId, consultantId)
        )
      );

    if (!job) {
      return res.status(404).json({ success: false, error: "Import job not found" });
    }

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial state
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    // Poll for updates every second
    const interval = setInterval(async () => {
      try {
        const [updatedJob] = await db
          .select()
          .from(schema.emailImportJobs)
          .where(eq(schema.emailImportJobs.id, jobId));

        if (updatedJob) {
          res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);

          // Stop polling if job is completed, failed, or cancelled
          if (["completed", "failed", "cancelled"].includes(updatedJob.status)) {
            clearInterval(interval);
            res.end();
          }
        }
      } catch (err) {
        console.error("[EMAIL-IMPORT] SSE poll error:", err);
      }
    }, 1000);

    // Clean up on client disconnect
    req.on("close", () => {
      clearInterval(interval);
    });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error setting up progress stream:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause import job
router.post("/import/:jobId/pause", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { jobId } = req.params;

    const [job] = await db
      .update(schema.emailImportJobs)
      .set({ status: "paused", updatedAt: new Date() })
      .where(
        and(
          eq(schema.emailImportJobs.id, jobId),
          eq(schema.emailImportJobs.consultantId, consultantId),
          eq(schema.emailImportJobs.status, "running")
        )
      )
      .returning();

    if (!job) {
      return res.status(404).json({ success: false, error: "Running job not found" });
    }

    console.log(`[EMAIL-IMPORT] Paused job ${jobId}`);
    res.json({ success: true, data: job });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error pausing job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume import job
router.post("/import/:jobId/resume", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { jobId } = req.params;

    const [job] = await db
      .select()
      .from(schema.emailImportJobs)
      .where(
        and(
          eq(schema.emailImportJobs.id, jobId),
          eq(schema.emailImportJobs.consultantId, consultantId),
          eq(schema.emailImportJobs.status, "paused")
        )
      );

    if (!job) {
      return res.status(404).json({ success: false, error: "Paused job not found" });
    }

    // Get account details
    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, job.accountId));

    if (!account || !account.imapHost) {
      return res.status(400).json({ success: false, error: "Account IMAP not configured" });
    }

    // Update status to running
    await db
      .update(schema.emailImportJobs)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(schema.emailImportJobs.id, jobId));

    // Resume the worker
    const folderProgress = job.folderProgress as Record<string, any>;
    const foldersToImport = Object.keys(folderProgress).map(path => ({ path, type: path.includes("Sent") ? "sent" : path.includes("Draft") ? "drafts" : "inbox" }));
    
    startImportWorker(jobId, account as any, foldersToImport, job.batchSize || 100);

    console.log(`[EMAIL-IMPORT] Resumed job ${jobId}`);
    res.json({ success: true, message: "Job resumed" });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error resuming job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel import job
router.post("/import/:jobId/cancel", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const { jobId } = req.params;

    const [job] = await db
      .update(schema.emailImportJobs)
      .set({ status: "cancelled", updatedAt: new Date(), completedAt: new Date() })
      .where(
        and(
          eq(schema.emailImportJobs.id, jobId),
          eq(schema.emailImportJobs.consultantId, consultantId),
          or(
            eq(schema.emailImportJobs.status, "running"),
            eq(schema.emailImportJobs.status, "paused"),
            eq(schema.emailImportJobs.status, "pending")
          )
        )
      )
      .returning();

    if (!job) {
      return res.status(404).json({ success: false, error: "Active job not found" });
    }

    console.log(`[EMAIL-IMPORT] Cancelled job ${jobId}`);
    res.json({ success: true, data: job });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error cancelling job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active import job for an account
router.get("/accounts/:id/import/active", async (req: AuthRequest, res) => {
  try {
    const consultantId = req.user!.id;
    const accountId = req.params.id;

    const [job] = await db
      .select()
      .from(schema.emailImportJobs)
      .where(
        and(
          eq(schema.emailImportJobs.accountId, accountId),
          eq(schema.emailImportJobs.consultantId, consultantId),
          or(
            eq(schema.emailImportJobs.status, "pending"),
            eq(schema.emailImportJobs.status, "running"),
            eq(schema.emailImportJobs.status, "paused")
          )
        )
      )
      .orderBy(desc(schema.emailImportJobs.createdAt))
      .limit(1);

    res.json({ success: true, data: job || null });
  } catch (error: any) {
    console.error("[EMAIL-IMPORT] Error getting active job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Background worker function to process import in batches
async function startImportWorker(
  jobId: string,
  account: {
    id: string;
    emailAddress: string;
    imapHost: string | null;
    imapPort: number | null;
    imapUser: string | null;
    imapPassword: string | null;
    imapTls: boolean | null;
  },
  foldersToImport: { path: string; type: string }[],
  batchSize: number
) {
  console.log(`[EMAIL-IMPORT] Starting worker for job ${jobId}`);

  try {
    // Mark job as running
    await db
      .update(schema.emailImportJobs)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.emailImportJobs.id, jobId));

    const imapService = createImapService({
      host: account.imapHost!,
      port: account.imapPort || 993,
      user: account.imapUser!,
      password: account.imapPassword!,
      tls: account.imapTls ?? true,
    });

    let totalImported = 0;
    let totalDuplicates = 0;
    let totalProcessed = 0;
    let totalEmails = 0;

    // First pass: count total emails in all folders
    for (let i = 0; i < foldersToImport.length; i++) {
      const folder = foldersToImport[i];
      try {
        const count = await imapService.getMailboxMessageCount(folder.path);
        totalEmails += count;
        
        // Update folder progress with total count
        const [job] = await db.select().from(schema.emailImportJobs).where(eq(schema.emailImportJobs.id, jobId));
        const folderProgress = (job?.folderProgress || {}) as Record<string, any>;
        folderProgress[folder.path] = { ...folderProgress[folder.path], totalMessages: count, status: "pending" };
        
        await db.update(schema.emailImportJobs).set({ 
          folderProgress, 
          totalEmails,
          updatedAt: new Date() 
        }).where(eq(schema.emailImportJobs.id, jobId));
      } catch (err: any) {
        console.error(`[EMAIL-IMPORT] Error counting folder ${folder.path}:`, err.message);
      }
    }

    console.log(`[EMAIL-IMPORT] Job ${jobId}: Total emails to process: ${totalEmails}`);

    // Second pass: import emails in batches
    for (let i = 0; i < foldersToImport.length; i++) {
      const folder = foldersToImport[i];
      
      // Check if job is paused or cancelled
      const [currentJob] = await db.select().from(schema.emailImportJobs).where(eq(schema.emailImportJobs.id, jobId));
      if (currentJob?.status === "paused" || currentJob?.status === "cancelled") {
        console.log(`[EMAIL-IMPORT] Job ${jobId} is ${currentJob.status}, stopping worker`);
        return;
      }

      // Update current folder
      await db.update(schema.emailImportJobs).set({ 
        currentFolderIndex: i,
        currentFolderPath: folder.path,
        updatedAt: new Date()
      }).where(eq(schema.emailImportJobs.id, jobId));

      console.log(`[EMAIL-IMPORT] Job ${jobId}: Processing folder ${folder.path} (${i + 1}/${foldersToImport.length})`);

      try {
        // Fetch emails from this folder
        const emails = await imapService.fetchRecentEmailsFromFolder(folder.path, 1000);
        
        const isSent = folder.type === "sent";
        const isDrafts = folder.type === "drafts";

        // Process in batches
        for (let j = 0; j < emails.length; j += batchSize) {
          // Check for pause/cancel between batches
          const [checkJob] = await db.select().from(schema.emailImportJobs).where(eq(schema.emailImportJobs.id, jobId));
          if (checkJob?.status === "paused" || checkJob?.status === "cancelled") {
            console.log(`[EMAIL-IMPORT] Job ${jobId} is ${checkJob.status}, stopping mid-batch`);
            return;
          }

          const batch = emails.slice(j, j + batchSize);
          
          for (const email of batch) {
            try {
              const existingEmail = await db
                .select({ id: schema.hubEmails.id })
                .from(schema.hubEmails)
                .where(
                  and(
                    eq(schema.hubEmails.accountId, account.id),
                    eq(schema.hubEmails.messageId, email.messageId)
                  )
                )
                .limit(1);

              if (existingEmail.length > 0) {
                totalDuplicates++;
              } else {
                await db.insert(schema.hubEmails).values({
                  accountId: account.id,
                  consultantId: currentJob!.consultantId,
                  messageId: email.messageId,
                  subject: email.subject,
                  fromName: email.fromName,
                  fromEmail: email.fromEmail,
                  toRecipients: email.toRecipients,
                  ccRecipients: email.ccRecipients,
                  bodyHtml: email.bodyHtml,
                  bodyText: email.bodyText,
                  snippet: email.snippet,
                  direction: isSent ? "outbound" : "inbound",
                  folder: folder.type,
                  isRead: isSent || isDrafts,
                  receivedAt: email.receivedAt,
                  attachments: email.attachments,
                  hasAttachments: email.hasAttachments,
                  inReplyTo: email.inReplyTo,
                  processingStatus: isSent ? "processed" : "new",
                });
                totalImported++;
              }
              totalProcessed++;
            } catch (emailErr: any) {
              console.error(`[EMAIL-IMPORT] Error processing email:`, emailErr.message);
            }
          }

          // Update progress after each batch
          const folderProgress = (checkJob?.folderProgress || {}) as Record<string, any>;
          folderProgress[folder.path] = { 
            ...folderProgress[folder.path], 
            processedMessages: Math.min(j + batchSize, emails.length),
            status: "in_progress"
          };

          await db.update(schema.emailImportJobs).set({ 
            processedEmails: totalProcessed,
            importedEmails: totalImported,
            duplicateEmails: totalDuplicates,
            folderProgress,
            updatedAt: new Date()
          }).where(eq(schema.emailImportJobs.id, jobId));

          console.log(`[EMAIL-IMPORT] Job ${jobId}: Batch completed. Processed: ${totalProcessed}/${totalEmails}, Imported: ${totalImported}, Duplicates: ${totalDuplicates}`);
        }

        // Mark folder as completed
        const [completedJob] = await db.select().from(schema.emailImportJobs).where(eq(schema.emailImportJobs.id, jobId));
        const folderProgress = (completedJob?.folderProgress || {}) as Record<string, any>;
        folderProgress[folder.path] = { ...folderProgress[folder.path], status: "completed" };
        await db.update(schema.emailImportJobs).set({ folderProgress, updatedAt: new Date() }).where(eq(schema.emailImportJobs.id, jobId));

      } catch (folderErr: any) {
        console.error(`[EMAIL-IMPORT] Error processing folder ${folder.path}:`, folderErr.message);
        
        // Mark folder as failed but continue
        const [failedJob] = await db.select().from(schema.emailImportJobs).where(eq(schema.emailImportJobs.id, jobId));
        const folderProgress = (failedJob?.folderProgress || {}) as Record<string, any>;
        folderProgress[folder.path] = { ...folderProgress[folder.path], status: "failed" };
        await db.update(schema.emailImportJobs).set({ 
          folderProgress, 
          lastError: folderErr.message,
          errorCount: (failedJob?.errorCount || 0) + 1,
          updatedAt: new Date() 
        }).where(eq(schema.emailImportJobs.id, jobId));
      }
    }

    // Mark job as completed
    await db.update(schema.emailImportJobs).set({ 
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(schema.emailImportJobs.id, jobId));

    console.log(`[EMAIL-IMPORT] Job ${jobId} completed. Imported: ${totalImported}, Duplicates: ${totalDuplicates}`);

  } catch (error: any) {
    console.error(`[EMAIL-IMPORT] Worker error for job ${jobId}:`, error);
    
    await db.update(schema.emailImportJobs).set({ 
      status: "failed",
      lastError: error.message,
      updatedAt: new Date()
    }).where(eq(schema.emailImportJobs.id, jobId));
  }
}

export default router;
