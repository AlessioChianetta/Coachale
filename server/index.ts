import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { sendAutomatedEmails } from "./services/email-scheduler";
import { ensureEmailScheduler } from "./services/scheduler-registry";
import { storage } from "./storage";
import { startWhatsAppPolling } from "./whatsapp/polling-service";
import { startGhostConversationCleanup } from "./whatsapp/cleanup-ghost-conversations";
import { startCalendarSync } from "./services/calendar-sync-service";
import { startProactiveOutreachScheduler } from "./whatsapp/proactive-outreach";
import { pollingScheduler } from "./services/lead-polling-scheduler";
import { startTrainingAggregator } from "./jobs/training-summary-aggregator";
import { verifyEncryptionConfig } from "./encryption";
import { setupWebSocketTest } from "./test-websocket";
import { setupGeminiLiveWSService } from "./ai/gemini-live-ws-service";
import { setupVideoCopilotWebSocket } from "./websocket/video-ai-copilot";
import { initFollowupScheduler } from "./cron/followup-scheduler";

function validateEnvironmentVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'ENCRYPTION_KEY',
    'SESSION_SECRET'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n💡 Create a .env file with these variables or set them in your environment.');
    console.error('   See .env.example for reference.\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables are set');
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files (audio, images, etc.)
app.use('/uploads', express.static('uploads'));

// Serve AI voice audio files
app.use('/uploads/ai-voice', express.static('storage/ai-voice/audio'));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Validate environment variables on startup
  validateEnvironmentVariables();

  // Verify encryption configuration on startup
  try {
    verifyEncryptionConfig();
  } catch (error: any) {
    console.error("❌ CRITICAL: Encryption configuration failed:", error.message);
    process.exit(1); // Exit if encryption is not properly configured
  }

  const server = await registerRoutes(app);

  // Setup WebSocket test server
  //setupWebSocketTest(server);

  // Setup Gemini Live API WebSocket server (noServer mode)
  const wssGemini = setupGeminiLiveWSService();

  // Setup Video AI Copilot WebSocket server for video calls (noServer mode)
  const wssVideo = setupVideoCopilotWebSocket();

  // Handle WebSocket upgrades - route to appropriate WebSocket server based on path
  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`).pathname;
    
    if (pathname === '/ws/ai-voice') {
      wssGemini.handleUpgrade(request, socket, head, (ws) => {
        wssGemini.emit('connection', ws, request);
      });
    } else if (pathname === '/ws/video-copilot') {
      wssVideo.handleUpgrade(request, socket, head, (ws) => {
        wssVideo.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Enhanced database error handling middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Check if it's our database retry error
    if (err.name === 'DatabaseRetryError') {
      console.error(`Database retry failed for ${req.method} ${req.path}:`, err.message);
      return res.status(503).json({ 
        message: "Database temporarily unavailable. Please try again in a moment.",
        retryAfter: 5 // seconds
      });
    }

    // Check if it's a Supabase/Neon connection error
    if (err.code === 'XX000' || 
        (err.message && err.message.includes('db_termination')) ||
        (err.message && err.message.includes('connection terminated'))) {
      console.error(`Database connection error for ${req.method} ${req.path}:`, err.message);
      return res.status(503).json({ 
        message: "Database connection issue. Please try again.",
        retryAfter: 3
      });
    }

    // Handle validation errors (from Zod)
    if (err.name === 'ZodError') {
      const validationErrors = err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    // Handle authentication errors
    if (err.name === 'JsonWebTokenError' || err.message?.includes('jwt')) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    // Default error handling
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error details for debugging (sanitized - no credentials)
    console.error(`Error in ${req.method} ${req.path}:`, {
      status,
      code: err.code,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });

    // Send response
    res.status(status).json({ 
      message: process.env.NODE_ENV === 'development' ? message : "Internal Server Error"
    });

    // Don't re-throw the error - let Express handle it gracefully
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Setup automated email scheduler
  // 🔒 Uses globalThis registry to prevent duplicate cron jobs during hot reload
  const emailSchedulerEnabled = process.env.EMAIL_SCHEDULER_ENABLED !== "false";
  // Schedule: Run every hour, but emails are only sent after 13:00 of the scheduled day
  const cronSchedule = "0 * * * *";


  if (emailSchedulerEnabled) {
    const registrationId = Math.random().toString(36).substring(7);
    const processInfo = `PID:${process.pid} | RegID:${registrationId}`;
    
    log(`📧 [${processInfo}] Email scheduler enabled - ensuring cron job with schedule: ${cronSchedule}`);
    
    // Use registry to ensure only ONE scheduler is active (safe for hot reload)
    ensureEmailScheduler(
      cronSchedule,
      async () => {
        const executionId = Math.random().toString(36).substring(7);
        log(`📬 [PID:${process.pid} | ExecID:${executionId}] ⏰ Cron job triggered - Running automated email scheduler...`);
        try {
          await sendAutomatedEmails();
        } catch (error: any) {
          console.error(`❌ [ExecID:${executionId}] Error in automated email scheduler:`, error);
        }
      },
      registrationId
    );
    
    log(`✅ [${processInfo}] Email scheduler registration completed`);
    
    // Optional: Run immediately on startup if flag is set
    if (process.env.EMAIL_SCHEDULER_RUN_ON_STARTUP === "true") {
      log("📬 Running automated email scheduler on startup...");
      setTimeout(async () => {
        try {
          await sendAutomatedEmails();
        } catch (error: any) {
          console.error("❌ Error in automated email scheduler:", error);
        }
      }, 5000); // Wait 5 seconds after startup
    }
  } else {
    log("📧 Email scheduler is disabled (set EMAIL_SCHEDULER_ENABLED=true to enable)");
  }

  // Setup WhatsApp polling service (alternative to webhooks)
  const whatsappPollingEnabled = process.env.WHATSAPP_POLLING_ENABLED !== "false";
  
  if (whatsappPollingEnabled) {
    log("📱 WhatsApp polling service enabled - starting polling...");
    startWhatsAppPolling();
    log("✅ WhatsApp polling service started");
    
    log("🧹 Starting ghost conversation cleanup service...");
    startGhostConversationCleanup();
    log("✅ Ghost conversation cleanup service started");
  } else {
    log("📱 WhatsApp polling service is disabled (set WHATSAPP_POLLING_ENABLED=true to enable)");
  }

  // Setup Google Calendar sync service
  const calendarSyncEnabled = process.env.CALENDAR_SYNC_ENABLED !== "false";
  
  if (calendarSyncEnabled) {
    log("📅 Google Calendar sync service enabled - starting sync...");
    startCalendarSync();
    log("✅ Google Calendar sync service started");
  } else {
    log("📅 Google Calendar sync service is disabled (set CALENDAR_SYNC_ENABLED=true to enable)");
  }

  // Setup Proactive Outreach scheduler
  // ⚠️ DEPRECATED: proactive-outreach.ts è stato sostituito da followup-scheduler.ts
  // Il nuovo sistema usa AI per decidere quando e come fare follow-up
  // Mantenuto per backward compatibility ma disabilitato di default
  const proactiveOutreachEnabled = process.env.PROACTIVE_OUTREACH_ENABLED === "true";
  
  if (proactiveOutreachEnabled) {
    log("⚠️ DEPRECATED: Proactive outreach scheduler is deprecated - use followup-scheduler instead");
    log("📤 Starting legacy proactive outreach scheduler...");
    startProactiveOutreachScheduler();
    log("✅ Legacy proactive outreach scheduler started (will be removed in future version)");
  } else {
    log("📤 Legacy proactive outreach disabled - using new followup-scheduler.ts system");
  }

  // Setup Lead Polling Scheduler
  const leadPollingEnabled = process.env.LEAD_POLLING_ENABLED !== "false";
  
  if (leadPollingEnabled) {
    log("📥 Lead polling scheduler enabled - initializing...");
    try {
      await pollingScheduler.initialize();
      log("✅ Lead polling scheduler initialized");
    } catch (error: any) {
      console.error("❌ Error initializing lead polling scheduler:", error);
    }
  } else {
    log("📥 Lead polling scheduler is disabled (set LEAD_POLLING_ENABLED=true to enable)");
  }

  // Setup Training Summary Aggregator (Daily at 3 AM)
  const trainingAggregatorEnabled = process.env.TRAINING_AGGREGATOR_ENABLED !== "false";
  
  if (trainingAggregatorEnabled) {
    log("📊 Training summary aggregator enabled - starting scheduler...");
    startTrainingAggregator();
    log("✅ Training summary aggregator started");
  } else {
    log("📊 Training summary aggregator is disabled (set TRAINING_AGGREGATOR_ENABLED=true to enable)");
  }

  // Setup Follow-up Scheduler for automated WhatsApp follow-ups
  const followupSchedulerEnabled = process.env.FOLLOWUP_SCHEDULER_ENABLED !== "false";
  
  if (followupSchedulerEnabled) {
    log("⚡ Follow-up scheduler enabled - starting scheduler...");
    initFollowupScheduler();
    log("✅ Follow-up scheduler started");
  } else {
    log("⚡ Follow-up scheduler is disabled (set FOLLOWUP_SCHEDULER_ENABLED=true to enable)");
  }
})();
