import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { authenticateToken, requireRole, type AuthRequest } from "./middleware/auth";
import { upload } from "./middleware/upload";
import { 
  loginSchema, 
  registerSchema,
  updateClientAiConfigSchema,
  insertExerciseSchema,
  insertExerciseTemplateSchema,
  insertExerciseAssignmentSchema,
  insertExerciseSubmissionSchema,
  insertExerciseDraftSchema,
  insertConsultationSchema,
  updateConsultationSchema,
  insertGoalSchema,
  insertClientProgressSchema,
  insertRoadmapPhaseSchema,
  insertRoadmapGroupSchema,
  insertRoadmapItemSchema,
  insertClientRoadmapProgressSchema,
  insertLibraryCategorySchema,
  insertLibrarySubcategorySchema,
  insertLibraryDocumentSchema,
  insertLibraryDocumentSectionSchema,
  insertClientLibraryProgressSchema,
  insertDailyTaskSchema,
  insertDailyReflectionSchema,
  analyticsOverviewQuerySchema,
  analyticsCompletionTrendsQuerySchema,
  analyticsEngagementTrendsQuerySchema,
  analyticsClientPerformanceQuerySchema,
  analyticsClientEngagementQuerySchema,
  analyticsConsultantSummaryQuerySchema,
  analyticsClientSummaryQuerySchema,
  analyticsExercisePerformanceQuerySchema,
  insertUniversityYearSchema,
  insertUniversityTrimesterSchema,
  insertUniversityModuleSchema,
  insertUniversityLessonSchema,
  insertUniversityProgressSchema,
  insertUniversityGradeSchema,
  insertUniversityCertificateSchema,
  insertUniversityTemplateSchema,
  insertTemplateTrimesterSchema,
  insertTemplateModuleSchema,
  insertTemplateLessonSchema,
  insertUserBadgeSchema
} from "@shared/schema";
import path from "path";
import fs from "fs";
import { calculateTemplateDay } from "./services/email-scheduler";
import { eq, and, inArray, sql, desc, or, gte, lte, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import { Request, Response } from 'express'; // Import Request and Response types
import crypto from 'crypto'; // Import crypto for UUID generation
import { generateCertificatePDF } from "./pdfGenerator";
import financeSettingsRouter from "./routes/finance-settings";
import consultationTasksRouter from "./routes/consultation-tasks";
import clientStateRouter from "./routes/client-state";
import automatedEmailsRouter from "./routes/automated-emails";
import momentumRouter from "./routes/momentum";
import proactiveLeadsRouter from "./routes/proactive-leads";
import campaignsRouter from "./routes/campaigns";
import customTemplatesRouter from "./routes/whatsapp/custom-templates";
import templateAssignmentsRouter from "./routes/whatsapp/template-assignments-router";
import twilioTemplateExportRouter from "./routes/whatsapp/twilio-template-export-router";
import agentInstructionsRouter from "./routes/whatsapp/agent-instructions-router";
import templateApprovalRouter from "./routes/whatsapp/template-approval-router";
import agentKnowledgeRouter from "./routes/whatsapp/agent-knowledge-router";
import agentShareRouter from "./routes/whatsapp/agent-share-router";
import agentStatsRouter from "./routes/whatsapp/agent-stats-router";
import publicShareRouter from "./routes/whatsapp/public-share-router";
import externalApiRouter from "./routes/external-api";
import webhookRouter from "./routes/webhook";
import livePromptsRouter from "./routes/live-prompts";
import aiConsultationsRouter from "./routes/ai-consultations";
import salesAgentConfigRouter from "./routes/client/sales-agent-config";
import salesAgentKnowledgeRouter from "./routes/client/sales-agent-knowledge";
import publicSalesAgentRouter from "./routes/public/sales-agent";
import publicConsultationInvitesRouter from "./routes/public/consultation-invites";
import publicVideoMeetingRouter from "./routes/public/video-meeting";
import trainingAssistantRouter from "./routes/training-assistant";
import salesScriptsRouter from "./routes/sales-scripts";
import scriptBuilderRouter from "./routes/script-builder";
import aiTrainerRouter from "./routes/ai-trainer";
import humanSellersRouter, { publicMeetRouter } from "./routes/human-sellers";
import knowledgeDocumentsRouter from "./routes/knowledge-documents";
import knowledgeApisRouter from "./routes/knowledge-apis";
import clientKnowledgeDocumentsRouter from "./routes/client/client-knowledge-documents";
import clientKnowledgeApisRouter from "./routes/client/client-knowledge-apis";
import googleDriveRouter from "./routes/google-drive";
import clientGoogleDriveRouter from "./routes/client/client-google-drive";
import adminRouter from "./routes/admin";
import onboardingRouter from "./routes/onboarding";
import followupApiRouter from "./routes/followup-api";
import fileSearchRouter from "./routes/file-search";
import echoRouter from "./routes/echo";
import { fileSearchSyncService } from "./services/file-search-sync-service";
import { FileSearchService } from "./ai/file-search-service";
import { generateConsultationSummaryEmail } from "./ai/email-template-generator";
import { handleWebhook } from "./whatsapp/webhook-handler";
import { sendWhatsAppMessage } from "./whatsapp/twilio-client";
import { scheduleMessageProcessing } from "./whatsapp/message-processor";
import { processConsultantAgentMessage, generateConversationTitle } from './whatsapp/agent-consultant-chat-service';
import { generateSpeech } from './ai/tts-service';
import { getAIProvider, getModelWithThinking } from './ai/provider-factory';
import { shouldRespondWithAudio } from './whatsapp/audio-response-utils';
import multer from 'multer';
import { nanoid } from "nanoid";
import twilio from "twilio";
import { getAudioDurationInSeconds } from "get-audio-duration";
import * as googleCalendarService from './google-calendar-service';
import { 
  getAuthorizationUrl, 
  exchangeCodeForTokens, 
  getPrimaryCalendarId,
  syncGoogleCalendarToLocal,
  isGoogleCalendarConnected,
  buildBaseUrlFromRequest
} from "./google-calendar-service";
import { encrypt, decrypt, encryptForConsultant, decryptForConsultant, generateEncryptionSalt } from "./encryption";
import { getTurnCredentialsForMeeting } from "./services/turn-config-service";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve static files from uploads directory with proper headers for audio
  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      // Detect if this is an audio file
      const isAudio = filePath.endsWith('.ogg') || 
                      filePath.endsWith('.wav') || 
                      filePath.endsWith('.webm') || 
                      filePath.endsWith('.mp3') || 
                      filePath.endsWith('.m4a');
      
      if (isAudio) {
        // CORS headers for audio files only
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Range');
        res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
        
        // Content-Type based on file extension
        if (filePath.endsWith('.ogg')) {
          res.set('Content-Type', 'audio/ogg');
        } else if (filePath.endsWith('.wav')) {
          res.set('Content-Type', 'audio/wav');
        } else if (filePath.endsWith('.webm')) {
          res.set('Content-Type', 'audio/webm');
        } else if (filePath.endsWith('.mp3')) {
          res.set('Content-Type', 'audio/mpeg');
        } else if (filePath.endsWith('.m4a')) {
          res.set('Content-Type', 'audio/mp4');
        }
        
        // Cache control for audio files only
        res.set('Cache-Control', 'public, max-age=3600');
        
        // Accept-Ranges for audio seeking
        res.set('Accept-Ranges', 'bytes');
      }
    }
  }));

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);

      // Create user
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword,
      });

      // Initialize email journey records for new clients
      if (user.role === 'client' && user.consultantId) {
        console.log(`🔄 [NEW CLIENT] Initializing email journey for ${user.firstName} ${user.lastName}`);
        
        try {
          // 1. Create client_email_automation record (disabled by default - drafts mode)
          await storage.upsertClientEmailAutomation({
            consultantId: user.consultantId,
            clientId: user.id,
            enabled: false, // Drafts mode by default - consultant can enable auto-send later
          });
          console.log(`✅ [NEW CLIENT] Email automation record created (drafts mode)`);
          
          // 2. Create client_state_tracking with placeholder values
          // These should be updated by the consultant during onboarding
          await storage.upsertClientState({
            clientId: user.id,
            consultantId: user.consultantId,
            currentState: `Nuovo cliente - ${user.firstName} sta iniziando il percorso`,
            idealState: `Da definire durante la prima consulenza`,
            internalBenefit: null,
            externalBenefit: null,
            mainObstacle: null,
            pastAttempts: null,
            currentActions: null,
            futureVision: null,
            motivationDrivers: null,
          });
          console.log(`✅ [NEW CLIENT] Client state tracking record created (placeholder)`);
        } catch (initError: any) {
          // Log but don't fail registration if initialization fails
          console.error(`⚠️  [NEW CLIENT] Failed to initialize email journey records:`, initError.message);
        }
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          avatar: user.avatar,
          geminiApiKeys: user.geminiApiKeys,
        },
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check for user role profiles (Email Condivisa feature)
      let profiles = await storage.getUserRoleProfiles(user.id);

      // If no profiles exist, create default profile based on users.role
      if (profiles.length === 0) {
        const defaultProfile = await storage.createUserRoleProfile({
          userId: user.id,
          role: user.role,
          consultantId: user.role === 'client' ? user.consultantId : null,
          isDefault: true,
          isActive: true,
        });
        profiles = [defaultProfile];
      }

      // If user has multiple profiles, require profile selection
      if (profiles.length > 1) {
        // Generate a temporary token for profile selection (short-lived)
        const tempToken = jwt.sign({ userId: user.id, requireProfileSelection: true }, JWT_SECRET, { expiresIn: '5m' });
        
        return res.json({
          message: "Profile selection required",
          requireProfileSelection: true,
          tempToken,
          profiles: profiles.map(p => ({
            id: p.id,
            role: p.role,
            consultantId: p.consultantId,
            isDefault: p.isDefault,
          })),
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
          },
        });
      }

      // Single profile: use that profile's role
      const activeProfile = profiles[0];
      const token = jwt.sign({ userId: user.id, profileId: activeProfile.id }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: activeProfile.role,
          avatar: user.avatar,
          geminiApiKeys: user.geminiApiKeys,
          isActive: user.isActive,
          profileId: activeProfile.id,
          consultantId: activeProfile.consultantId || user.consultantId,
          siteUrl: user.siteUrl,
        },
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  // Select profile endpoint (Email Condivisa feature)
  app.post("/api/auth/select-profile", async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      const tempToken = authHeader && authHeader.split(' ')[1];

      if (!tempToken) {
        return res.status(401).json({ message: 'Token required' });
      }

      const { profileId } = req.body;
      if (!profileId) {
        return res.status(400).json({ message: 'Profile ID required' });
      }

      // Verify temp token
      let decoded: any;
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      const userId = decoded.userId;

      // Get user and verify profile belongs to them
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      const profile = await storage.getUserRoleProfileById(profileId);
      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: 'Profile not found or access denied' });
      }

      if (!profile.isActive) {
        return res.status(403).json({ message: 'Profile is not active' });
      }

      // Set this profile as default
      await storage.setDefaultProfile(userId, profileId);

      // Generate new JWT with profileId
      const token = jwt.sign({ userId: user.id, profileId: profile.id }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: "Profile selected successfully",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: profile.role,
          avatar: user.avatar,
          geminiApiKeys: user.geminiApiKeys,
          isActive: user.isActive,
          profileId: profile.id,
          consultantId: profile.consultantId || user.consultantId,
          siteUrl: user.siteUrl,
        },
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Profile selection failed" });
    }
  });

  // Get user's profiles for profile switching (Email Condivisa feature)
  app.get("/api/auth/my-profiles", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const profiles = await storage.getUserRoleProfiles(userId);
      
      // For each profile, get consultant name if it's a client profile
      const profilesWithNames = await Promise.all(profiles.map(async (profile) => {
        let consultantName = null;
        if (profile.role === 'client' && profile.consultantId) {
          const consultant = await storage.getUser(profile.consultantId);
          if (consultant) {
            consultantName = `${consultant.firstName} ${consultant.lastName}`;
          }
        }
        return {
          id: profile.id,
          role: profile.role,
          consultantId: profile.consultantId,
          consultantName,
          isDefault: profile.isDefault,
          isActive: profile.isActive,
        };
      }));

      res.json({ profiles: profilesWithNames });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        avatar: user.avatar,
        geminiApiKeys: user.geminiApiKeys,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Exercise routes
  app.post("/api/exercises", authenticateToken, requireRole("consultant"), upload.array('attachments', 5), async (req: AuthRequest, res) => {
    try {
      console.log('🎯 EXERCISE CREATION API CALLED', {
        timestamp: new Date().toISOString(),
        userId: req.user!.id,
        bodyKeys: Object.keys(req.body),
        hasLibraryDocumentId: !!req.body.libraryDocumentId,
        libraryDocumentId: req.body.libraryDocumentId
      });

      console.log('📋 RAW REQUEST BODY', {
        title: req.body.title,
        libraryDocumentId: req.body.libraryDocumentId,
        libraryDocumentIdType: typeof req.body.libraryDocumentId,
        libraryDocumentIdLength: req.body.libraryDocumentId?.length,
        allFields: req.body
      });

      const exerciseData = {
        title: req.body.title,
        description: req.body.description,
        type: req.body.type,
        category: req.body.category,
        instructions: req.body.instructions,
        estimatedDuration: req.body.estimatedDuration ? parseInt(req.body.estimatedDuration) : null,
        priority: req.body.priority || 'medium',
        workPlatform: req.body.workPlatform || null,
        libraryDocumentId: req.body.libraryDocumentId || null,
        questions: req.body.questions ? (typeof req.body.questions === 'string' ? JSON.parse(req.body.questions) : req.body.questions) : [],
        isPublic: req.body.isPublic === 'true' || req.body.isPublic === true,
        selectedClients: req.body.selectedClients ? (typeof req.body.selectedClients === 'string' ? JSON.parse(req.body.selectedClients) : req.body.selectedClients) : [],
        customPlatformLinks: req.body.customPlatformLinks ? (typeof req.body.customPlatformLinks === 'string' ? JSON.parse(req.body.customPlatformLinks) : req.body.customPlatformLinks) : {},
        createdBy: req.user!.id,
        attachments: [],
        // Exam-specific fields
        isExam: req.body.isExam === 'true',
        examDate: req.body.examDate ? new Date(req.body.examDate) : null,
        yearId: req.body.yearId || null,
        trimesterId: req.body.trimesterId || null,
        autoCorrect: req.body.autoCorrect === 'true',
        totalPoints: req.body.totalPoints ? parseInt(req.body.totalPoints) : null,
        passingScore: req.body.passingScore ? parseInt(req.body.passingScore) : null,
        examTimeLimit: req.body.examTimeLimit ? parseInt(req.body.examTimeLimit) : null,
      };

      console.log('📦 EXERCISE DATA OBJECT CREATED', {
        libraryDocumentId: exerciseData.libraryDocumentId,
        libraryDocumentIdType: typeof exerciseData.libraryDocumentId,
        libraryDocumentIdIsNull: exerciseData.libraryDocumentId === null,
        libraryDocumentIdValue: exerciseData.libraryDocumentId,
        // Exam fields
        isExam: exerciseData.isExam,
        examDate: exerciseData.examDate,
        yearId: exerciseData.yearId,
        trimesterId: exerciseData.trimesterId,
        autoCorrect: exerciseData.autoCorrect,
        totalPoints: exerciseData.totalPoints,
        passingScore: exerciseData.passingScore,
        examTimeLimit: exerciseData.examTimeLimit
      });

      // Validate selectedClients only if not public
      if (!exerciseData.isPublic && (!req.body.selectedClients || req.body.selectedClients.length === 0)) {
        return res.status(400).json({ message: "Devi selezionare almeno un cliente per assegnare l'esercizio" });
      }

      // Validate exam duplicates - prevent creating exams for the same year/trimester
      if (exerciseData.isExam && exerciseData.yearId && !exerciseData.isPublic && exerciseData.selectedClients && exerciseData.selectedClients.length > 0) {
        const clientsWithExistingExams = [];
        
        for (const clientId of exerciseData.selectedClients) {
          // Query for existing exam assignments for this client
          const existingExamAssignments = await db
            .select({
              exerciseId: schema.exerciseAssignments.exerciseId,
              clientId: schema.exerciseAssignments.clientId,
              isExam: schema.exercises.isExam,
              yearId: schema.exercises.yearId,
              trimesterId: schema.exercises.trimesterId,
              title: schema.exercises.title,
            })
            .from(schema.exerciseAssignments)
            .innerJoin(schema.exercises, eq(schema.exerciseAssignments.exerciseId, schema.exercises.id))
            .where(
              and(
                eq(schema.exerciseAssignments.clientId, clientId),
                eq(schema.exercises.isExam, true),
                eq(schema.exercises.yearId, exerciseData.yearId)
              )
            );

          // Check for duplicates based on year/trimester rules
          let hasDuplicate = false;
          let conflictingExam = null;

          for (const existing of existingExamAssignments) {
            // If creating annual exam (no trimester specified)
            if (!exerciseData.trimesterId) {
              // Block only if another annual exam exists for this year
              if (!existing.trimesterId) {
                hasDuplicate = true;
                conflictingExam = existing;
                break;
              }
            }
            // If creating trimester-specific exam
            else if (exerciseData.trimesterId) {
              // Block only if same trimester exam already exists
              if (existing.trimesterId === exerciseData.trimesterId) {
                hasDuplicate = true;
                conflictingExam = existing;
                break;
              }
            }
          }

          if (hasDuplicate && conflictingExam) {
            const client = await storage.getUser(clientId);
            const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente';
            const examType = !conflictingExam.trimesterId 
              ? "un esame annuale" 
              : "un esame per questo trimestre";
            clientsWithExistingExams.push({
              clientName,
              examTitle: conflictingExam.title,
              examType
            });
          }
        }

        // If there are clients with existing exams, return error
        if (clientsWithExistingExams.length > 0) {
          const errorMessages = clientsWithExistingExams.map(({ clientName, examTitle, examType }) => 
            `${clientName} ha già ${examType}: "${examTitle}"`
          );
          return res.status(400).json({ 
            message: "Non è possibile creare l'esame perché alcuni clienti hanno già esami per questo anno/trimestre",
            details: errorMessages
          });
        }
      }

      // Extract selectedClients and customPlatformLinks from exerciseData for validation - keep libraryDocumentId in the validated data
      const { selectedClients, customPlatformLinks, createdBy, ...exerciseValidationData } = exerciseData;
      const validatedData = insertExerciseSchema.parse(exerciseValidationData);

      // Process attachments
      if (req.files && Array.isArray(req.files)) {
        exerciseData.attachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size
        }));
      }

      console.log('💾 CALLING storage.createExercise WITH DATA', {
        timestamp: new Date().toISOString(),
        libraryDocumentId: exerciseData.libraryDocumentId,
        fullExerciseData: exerciseData
      });

      // Ensure libraryDocumentId is included in the data passed to createExercise
      const exerciseToCreate = {
        ...validatedData,
        libraryDocumentId: exerciseData.libraryDocumentId,
        attachments: exerciseData.attachments
      };

      const exercise = await storage.createExercise(exerciseToCreate, req.user!.id);

      console.log('✅ EXERCISE CREATED IN DATABASE', {
        exerciseId: exercise.id,
        libraryDocumentId: exercise.libraryDocumentId,
        timestamp: new Date().toISOString()
      });

      if (exerciseData.isPublic) {
        // Public exercise - no assignments needed
        res.status(201).json({
          exercise,
          assignments: 0,
          message: "Esercizio pubblico creato con successo"
        });
      } else {
        // Check for existing assignments to prevent duplicates
        const assignments = [];
        const skippedClients = [];

        // Ensure selectedClients is an array
        const clientIdsToAssign = Array.isArray(selectedClients) ? selectedClients : (typeof selectedClients === 'string' ? JSON.parse(selectedClients) : []);

        for (const clientId of clientIdsToAssign) {
          try {
            // Check if client already has an assignment for an exercise with similar title (from template)
            const existingAssignments = await storage.getAssignmentsByClient(clientId);
            const hasSimilarExercise = existingAssignments.some((assignment: any) => 
              assignment.exercise && 
              assignment.exercise.title && 
              exerciseData.title.includes("(da template)") &&
              assignment.exercise.title.replace(" (da template)", "") === exerciseData.title.replace(" (da template)", "")
            );

            if (hasSimilarExercise) {
              skippedClients.push(clientId);
              continue;
            }

            const assignment = await storage.createExerciseAssignment({
              exerciseId: exercise.id,
              clientId: clientId,
              consultantId: req.user!.id,
              dueDate: null,
              status: "pending",
              workPlatform: customPlatformLinks && customPlatformLinks[clientId] ? customPlatformLinks[clientId] : null
            });
            assignments.push(assignment);
            
            // PRIVACY ISOLATION: Sync exercise to client's private store
            fileSearchSyncService.syncExerciseToClient(exercise.id, clientId, req.user!.id).catch(err => {
              console.error(`[FileSync] Failed to sync exercise to client ${clientId}:`, err.message);
            });
          } catch (assignmentError: any) {
            console.error(`Failed to create assignment for client ${clientId}:`, assignmentError.message);
            skippedClients.push(clientId);
          }
        }

        let message = `Esercizio creato e assegnato a ${assignments.length} clienti`;
        if (skippedClients.length > 0) {
          message += `. ${skippedClients.length} clienti saltati (già assegnato)`;
        }

        res.status(201).json({
          exercise,
          assignments: assignments.length,
          skippedClients: skippedClients.length,
          message
        });
      }
    } catch (error: any) {
      console.error("Exercise creation error:", error);
      res.status(400).json({ message: error.message || "Errore durante la creazione dell'esercizio" });
    }
  });

  app.get("/api/exercises", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let exercises;

      if (req.user!.role === "consultant") {
        exercises = await storage.getExercisesByConsultant(req.user!.id);
      } else {
        exercises = await storage.getGeneralExercises();
      }

      res.json(exercises);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get public exercises
  app.get("/api/exercises/public", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Fetching public exercises for user:', req.user?.id);
      const exercises = await storage.getPublicExercises();
      console.log('Public exercises found:', exercises.length);
      if (exercises.length > 0) {
        console.log('First public exercise:', exercises[0]);
      }
      res.json(exercises);
    } catch (error: any) {
      console.error('Error fetching public exercises:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exercises/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const exercise = await storage.getExercise(req.params.id);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      // Check if user has access to this exercise
      if (req.user!.role === "consultant" && exercise.createdBy !== req.user!.id && exercise.type !== "general") {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(exercise);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/exercises/:id", authenticateToken, requireRole("consultant"), upload.array('attachments', 5), async (req: AuthRequest, res) => {
    try {
      console.log('🔄 EXERCISE UPDATE API CALLED', {
        timestamp: new Date().toISOString(),
        exerciseId: req.params.id,
        userId: req.user!.id,
        bodyKeys: Object.keys(req.body)
      });

      // Check if exercise exists and user has permission
      const existingExercise = await storage.getExercise(req.params.id);
      if (!existingExercise) {
        return res.status(404).json({ message: "Esercizio non trovato" });
      }

      if (existingExercise.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Non hai i permessi per modificare questo esercizio" });
      }

      // Parse selectedClients and customPlatformLinks if provided
      const selectedClients = req.body.selectedClients 
        ? (typeof req.body.selectedClients === 'string' ? JSON.parse(req.body.selectedClients) : req.body.selectedClients)
        : null;
      
      const customPlatformLinks = req.body.customPlatformLinks
        ? (typeof req.body.customPlatformLinks === 'string' ? JSON.parse(req.body.customPlatformLinks) : req.body.customPlatformLinks)
        : {};

      console.log('👥 SELECTED CLIENTS FOR UPDATE', {
        selectedClients,
        count: selectedClients ? selectedClients.length : 0
      });

      // Parse update data (same as POST endpoint)
      const updateData: any = {};

      if (req.body.title) updateData.title = req.body.title;
      if (req.body.description) updateData.description = req.body.description;
      if (req.body.type) updateData.type = req.body.type;
      if (req.body.category) updateData.category = req.body.category;
      if (req.body.instructions !== undefined) updateData.instructions = req.body.instructions;
      if (req.body.estimatedDuration) updateData.estimatedDuration = parseInt(req.body.estimatedDuration);
      if (req.body.priority) updateData.priority = req.body.priority;
      if (req.body.workPlatform !== undefined) updateData.workPlatform = req.body.workPlatform || null;
      if (req.body.libraryDocumentId !== undefined) updateData.libraryDocumentId = req.body.libraryDocumentId || null;
      
      if (req.body.questions) {
        updateData.questions = typeof req.body.questions === 'string' 
          ? JSON.parse(req.body.questions) 
          : req.body.questions;
      }

      if (req.body.isPublic !== undefined) {
        updateData.isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
      }

      // Exam-specific fields
      // Calculate effective isExam flag considering both request and existing exercise
      const effectiveIsExam = req.body.isExam !== undefined 
        ? (req.body.isExam === 'true' || req.body.isExam === true)
        : existingExercise.isExam;
      
      if (req.body.isExam !== undefined) {
        updateData.isExam = effectiveIsExam;
      }
      if (req.body.examDate) updateData.examDate = new Date(req.body.examDate);
      if (req.body.yearId !== undefined) updateData.yearId = req.body.yearId || null;
      if (req.body.trimesterId !== undefined) updateData.trimesterId = req.body.trimesterId || null;
      if (req.body.autoCorrect !== undefined) {
        updateData.autoCorrect = req.body.autoCorrect === 'true' || req.body.autoCorrect === true;
      }
      if (req.body.totalPoints) updateData.totalPoints = parseInt(req.body.totalPoints);
      if (req.body.passingScore) updateData.passingScore = parseInt(req.body.passingScore);
      if (req.body.examTimeLimit) updateData.examTimeLimit = parseInt(req.body.examTimeLimit);

      // Handle attachments - merge new with existing
      let attachments = existingExercise.attachments || [];
      
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const newAttachments = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: file.path,
          mimetype: file.mimetype,
          size: file.size
        }));
        attachments = [...attachments, ...newAttachments];
      }
      
      updateData.attachments = attachments;

      console.log('📦 UPDATE DATA PREPARED', {
        exerciseId: req.params.id,
        updateFields: Object.keys(updateData),
        hasNewAttachments: req.files && Array.isArray(req.files) && req.files.length > 0
      });

      // Handle assignment updates if selectedClients is provided and exercise is not public
      const newAssignments = [];
      const skippedClients = [];
      const isPublic = updateData.isPublic !== undefined ? updateData.isPublic : existingExercise.isPublic;

      if (selectedClients && selectedClients.length > 0 && !isPublic) {
        console.log('🔍 PROCESSING ASSIGNMENT UPDATES', {
          exerciseId: req.params.id,
          selectedClientsCount: selectedClients.length
        });

        // Get existing assignments for this exercise
        const existingAssignments = await db.select()
          .from(schema.exerciseAssignments)
          .where(eq(schema.exerciseAssignments.exerciseId, req.params.id));

        const existingClientIds = new Set(existingAssignments.map(a => a.clientId));
        
        console.log('📊 EXISTING ASSIGNMENTS', {
          existingCount: existingAssignments.length,
          existingClientIds: Array.from(existingClientIds)
        });

        // Identify new clients (not already assigned) and deduplicate
        const uniqueSelectedClients = [...new Set(selectedClients)];
        const newClientIds = uniqueSelectedClients.filter((clientId: string) => !existingClientIds.has(clientId));

        console.log('➕ NEW CLIENTS TO ASSIGN', {
          newClientsCount: newClientIds.length,
          newClientIds,
          duplicatesRemoved: selectedClients.length - uniqueSelectedClients.length
        });

        if (newClientIds.length > 0) {
          // For exams, validate no duplicates (same year/trimester)
          const yearId = updateData.yearId !== undefined ? updateData.yearId : existingExercise.yearId;
          const trimesterId = updateData.trimesterId !== undefined ? updateData.trimesterId : existingExercise.trimesterId;

          if (effectiveIsExam && yearId) {
            const clientsWithExistingExams = [];
            
            for (const clientId of newClientIds) {
              // Query for existing exam assignments for this client
              const existingExamAssignments = await db
                .select({
                  exerciseId: schema.exerciseAssignments.exerciseId,
                  clientId: schema.exerciseAssignments.clientId,
                  isExam: schema.exercises.isExam,
                  yearId: schema.exercises.yearId,
                  trimesterId: schema.exercises.trimesterId,
                  title: schema.exercises.title,
                })
                .from(schema.exerciseAssignments)
                .innerJoin(schema.exercises, eq(schema.exerciseAssignments.exerciseId, schema.exercises.id))
                .where(
                  and(
                    eq(schema.exerciseAssignments.clientId, clientId),
                    eq(schema.exercises.isExam, true),
                    eq(schema.exercises.yearId, yearId)
                  )
                );

              // Check for duplicates based on year/trimester rules
              let hasDuplicate = false;
              let conflictingExam = null;

              for (const existing of existingExamAssignments) {
                // Skip if this is the same exercise we're updating
                if (existing.exerciseId === req.params.id) continue;

                // If creating/updating to annual exam (no trimester specified)
                if (!trimesterId) {
                  // Block only if another annual exam exists for this year
                  if (!existing.trimesterId) {
                    hasDuplicate = true;
                    conflictingExam = existing;
                    break;
                  }
                }
                // If creating/updating to trimester-specific exam
                else if (trimesterId) {
                  // Block only if same trimester exam already exists
                  if (existing.trimesterId === trimesterId) {
                    hasDuplicate = true;
                    conflictingExam = existing;
                    break;
                  }
                }
              }

              if (hasDuplicate && conflictingExam) {
                const client = await storage.getUser(clientId);
                const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente';
                const examType = !conflictingExam.trimesterId 
                  ? "un esame annuale" 
                  : "un esame per questo trimestre";
                clientsWithExistingExams.push({
                  clientName,
                  examTitle: conflictingExam.title,
                  examType
                });
              }
            }

            // If there are clients with existing exams, return error
            if (clientsWithExistingExams.length > 0) {
              const errorMessages = clientsWithExistingExams.map(({ clientName, examTitle, examType }) => 
                `${clientName} ha già ${examType}: "${examTitle}"`
              );
              return res.status(400).json({ 
                message: "Non è possibile aggiornare l'esercizio perché alcuni clienti hanno già esami per questo anno/trimestre",
                details: errorMessages
              });
            }
          }

          // Create assignments for new clients
          for (const clientId of newClientIds) {
            try {
              const assignment = await storage.createExerciseAssignment({
                exerciseId: req.params.id,
                clientId: clientId,
                consultantId: req.user!.id,
                dueDate: null,
                status: "pending",
                workPlatform: customPlatformLinks && customPlatformLinks[clientId] ? customPlatformLinks[clientId] : null
              });
              newAssignments.push(assignment);
              console.log('✅ CREATED NEW ASSIGNMENT', {
                assignmentId: assignment.id,
                clientId,
                exerciseId: req.params.id
              });
              
              // PRIVACY ISOLATION: Sync exercise to client's private store
              fileSearchSyncService.syncExerciseToClient(req.params.id, clientId, req.user!.id).catch(err => {
                console.error(`[FileSync] Failed to sync exercise to client ${clientId}:`, err.message);
              });
            } catch (assignmentError: any) {
              console.error(`❌ Failed to create assignment for client ${clientId}:`, assignmentError.message);
              skippedClients.push(clientId);
            }
          }

          console.log('📈 ASSIGNMENT CREATION SUMMARY', {
            newAssignmentsCreated: newAssignments.length,
            clientsSkipped: skippedClients.length,
            existingAssignmentsKept: existingAssignments.length
          });
        }
      }

      // Update exercise
      const updatedExercise = await storage.updateExercise(req.params.id, updateData);

      if (!updatedExercise) {
        return res.status(404).json({ message: "Errore durante l'aggiornamento dell'esercizio" });
      }

      console.log('✅ EXERCISE UPDATED SUCCESSFULLY', {
        exerciseId: updatedExercise.id,
        timestamp: new Date().toISOString(),
        newAssignments: newAssignments.length,
        skippedClients: skippedClients.length
      });

      let message = "Esercizio aggiornato con successo";
      if (newAssignments.length > 0) {
        message += `. ${newAssignments.length} nuovi clienti assegnati`;
      }
      if (skippedClients.length > 0) {
        message += `. ${skippedClients.length} clienti saltati (errore durante l'assegnazione)`;
      }

      res.json({
        exercise: updatedExercise,
        newAssignments: newAssignments.length,
        skippedClients: skippedClients.length,
        message
      });
    } catch (error: any) {
      console.error("Exercise update error:", error);
      res.status(400).json({ message: error.message || "Errore durante l'aggiornamento dell'esercizio" });
    }
  });

  app.delete("/api/exercises/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const exercise = await storage.getExercise(req.params.id);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      // Check if user owns this exercise
      if (exercise.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.deleteExercise(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      res.json({ message: "Exercise deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Exercise template routes
  app.post("/api/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertExerciseTemplateSchema.parse(req.body);

      const template = await storage.createExerciseTemplate(validatedData, req.user!.id);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { category, tags, type, isPublic, search } = req.query;

      let templates;

      if (req.user!.role === "consultant") {
        // Get consultant's own templates
        let ownTemplates = await storage.getExerciseTemplatesByConsultant(req.user!.id);

        // Get public templates
        let publicTemplates = await storage.getPublicExerciseTemplates();

        // Combine and deduplicate
        const templateMap = new Map();
        ownTemplates.forEach(t => templateMap.set(t.id, t));
        publicTemplates.forEach(t => templateMap.set(t.id, t));

        templates = Array.from(templateMap.values());
      } else {
        // Clients can only see public templates
        templates = await storage.getPublicExerciseTemplates();
      }

      // Apply filters
      if (category || tags || type || isPublic !== undefined) {
        const filters: any = {};
        if (category) filters.category = category as string;
        if (tags) filters.tags = typeof tags === 'string' ? [tags] : tags as string[];
        if (type) filters.type = type as "general" | "personalized";
        if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

        templates = await storage.searchExerciseTemplates(filters);
      }

      // Apply text search if provided
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        templates = templates.filter(template => 
          template.name.toLowerCase().includes(searchTerm) ||
          template.description.toLowerCase().includes(searchTerm) ||
          template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user has access to this template
      if (!template.isPublic && template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user owns this template
      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updates = insertExerciseTemplateSchema.partial().parse(req.body);
      const updatedTemplate = await storage.updateExerciseTemplate(req.params.id, updates);

      res.json(updatedTemplate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { deleteAssociatedExercises } = req.query;

      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user owns this template
      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If requested, delete associated exercises first
      if (deleteAssociatedExercises === 'true') {
        await storage.deleteExercisesFromTemplate(req.params.id, req.user!.id);
      }

      // Check if there are still associated exercises (if user didn't choose to delete them)
      if (deleteAssociatedExercises !== 'true') {
        const hasAssociatedExercises = await storage.hasAssociatedExercises(req.params.id);
        if (hasAssociatedExercises) {
          return res.status(400).json({ 
            message: "Cannot delete template with associated exercises. Please delete associated exercises first." 
          });
        }
      }

      // Force delete the template since we've handled associated exercises appropriately
      const result = await db.delete(schema.exerciseTemplates)
        .where(eq(schema.exerciseTemplates.id, req.params.id));

      if (result.rowCount === 0) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({ 
        message: deleteAssociatedExercises === 'true' 
          ? "Template e esercizi associati eliminati con successo" 
          : "Template eliminato con successo" 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/templates/:id/associated-exercises", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user owns this template
      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const associatedExercises = await storage.getExercisesFromTemplate(req.params.id, req.user!.id);
      res.json({ 
        count: associatedExercises.length,
        exercises: associatedExercises 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/templates/:id/use", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Check if user has access to this template
      if (!template.isPublic && template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const exercise = await storage.copyTemplateToExercise(req.params.id, req.user!.id);
      res.status(201).json(exercise);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Template-Client Association Routes
  app.post("/api/templates/:id/associate-clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientIds } = req.body;

      // Verify template ownership
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.associateTemplateWithClients(req.params.id, clientIds || [], req.user!.id);
      res.json({ message: "Template associations updated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/templates/:id/associations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Verify template ownership
      const template = await storage.getExerciseTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const associations = await storage.getTemplateClientAssociations(req.params.id, req.user!.id);

      // Get client details
      const associationsWithClients = await Promise.all(
        associations.map(async (assoc) => {
          const client = await storage.getUser(assoc.clientId);
          return {
            ...assoc,
            client: client ? {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              avatar: client.avatar,
            } : null,
          };
        })
      );

      res.json(associationsWithClients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/templates/:templateId/clients/:clientId/visibility", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { isVisible } = req.body;

      // Verify template ownership
      const template = await storage.getExerciseTemplate(req.params.templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      if (template.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateTemplateClientVisibility(
        req.params.templateId, 
        req.params.clientId, 
        req.user!.id, 
        isVisible
      );

      res.json({ message: "Visibility updated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get templates visible to a client (for client-side access)
  app.get("/api/templates/client/visible", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getVisibleTemplatesForClient(req.user!.id);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Exercise assignment routes
  app.post("/api/exercise-assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertExerciseAssignmentSchema.parse({
        ...req.body,
        consultantId: req.user!.id,
      });

      const assignment = await storage.createExerciseAssignment(validatedData);
      
      // PRIVACY ISOLATION: Sync exercise to client's private store
      fileSearchSyncService.syncExerciseToClient(validatedData.exerciseId, validatedData.clientId, req.user!.id).catch(err => {
        console.error(`[FileSync] Failed to sync exercise to client:`, err.message);
      });
      
      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/exercise-assignments/client", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const options: { isExam?: boolean } = {};
      
      // Parse isExam query parameter
      if (req.query.isExam !== undefined) {
        options.isExam = req.query.isExam === 'true';
      }
      
      const assignments = await storage.getAssignmentsByClient(req.user!.id, options);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exercises/client", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getAssignmentsByClient(req.user!.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exercise-assignments/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getAssignmentsByConsultant(req.user!.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/exercise-assignments/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const assignment = await storage.getExerciseAssignment(req.params.id);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Check if user has access to this assignment
      if (req.user!.role === "client" && assignment.clientId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant" && assignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get consultant data
      const consultant = await storage.getUser(assignment.consultantId);
      if (consultant) {
        (assignment as any).consultant = {
          id: consultant.id,
          firstName: consultant.firstName,
          lastName: consultant.lastName,
          email: consultant.email,
        };
      }

      res.json(assignment);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update WhatsApp sent status
  app.patch("/api/exercise-assignments/:assignmentId/whatsapp-sent", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { assignmentId } = req.params;
      const { whatsappSent } = req.body;

      if (typeof whatsappSent !== 'boolean') {
        return res.status(400).json({ message: "whatsappSent must be a boolean" });
      }

      const assignment = await storage.getExerciseAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Check if user has permission (consultant who created the assignment)
      if (assignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.updateAssignmentWhatsappSent(assignmentId, whatsappSent);
      res.status(200).json({ 
        success: true,
        message: whatsappSent ? "WhatsApp status marked as sent" : "WhatsApp status reactivated" 
      });
    } catch (error: any) {
      console.error("WhatsApp status update error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Internal server error" 
      });
    }
  });

  // Update assignment status
  app.patch("/api/exercise-assignments/:assignmentId/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const assignment = await storage.updateAssignmentStatus(req.params.assignmentId, status);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Start exercise (client only - changes status from pending to in_progress)
  app.post("/api/exercise-assignments/:id/start", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id; // Assuming authenticateToken adds user to req

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the assignment to verify ownership
      const assignment = await storage.getExerciseAssignment(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Verify the user is the client for this assignment
      if (assignment.clientId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Only allow starting if status is pending
      if (assignment.status !== 'pending') {
        return res.status(400).json({ error: "L'esercizio può essere avviato solo se è in stato 'pending'" });
      }

      // Update status to in_progress
      const updatedAssignment = await storage.updateAssignmentStatus(id, "in_progress");

      res.json({
        message: "Esercizio avviato con successo",
        assignment: updatedAssignment
      });
    } catch (error: any) {
      console.error("Error starting exercise:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset exercise (hidden command - changes status from in_progress to pending)
  app.post("/api/exercise-assignments/:id/reset", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get the assignment to verify ownership
      const assignment = await storage.getExerciseAssignment(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      // Verify the user is the client for this assignment
      if (assignment.clientId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Only allow resetting if status is in_progress
      if (assignment.status !== 'in_progress') {
        return res.status(400).json({ error: "L'esercizio può essere resettato solo se è in stato 'in_progress'" });
      }

      // Update status back to pending
      const updatedAssignment = await storage.updateAssignmentStatus(id, "pending");

      res.json({
        message: "Esercizio resettato con successo",
        assignment: updatedAssignment
      });
    } catch (error: any) {
      console.error("Error resetting exercise:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get review data for assignment (consultant only)
  app.get("/api/exercise-assignments/:id/review-data", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Get assignment
      const assignment = await storage.getExerciseAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Verify ownership
      if (assignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get exercise with questions
      const exercise = await storage.getExercise(assignment.exerciseId);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      // Get submission with student answers
      const submission = await storage.getExerciseSubmissionByAssignment(req.params.id);

      // Return consolidated review data
      res.json({
        assignment: {
          id: assignment.id,
          exerciseId: assignment.exerciseId,
          clientId: assignment.clientId,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          submittedAt: assignment.submittedAt,
          examSubmittedAt: assignment.examSubmittedAt,
          autoGradedScore: assignment.autoGradedScore,
          questionGrades: assignment.questionGrades,
          score: assignment.score,
          consultantFeedback: assignment.consultantFeedback,
          reviewedAt: assignment.reviewedAt,
        },
        exercise: {
          id: exercise.id,
          title: exercise.title,
          description: exercise.description,
          questions: exercise.questions,
          isExam: exercise.isExam,
          autoCorrect: exercise.autoCorrect,
          totalPoints: exercise.totalPoints,
          passingScore: exercise.passingScore,
        },
        submission: submission ? {
          id: submission.id,
          assignmentId: submission.assignmentId,
          answers: submission.answers,
          submittedAt: submission.submittedAt,
          attachments: submission.attachments,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching review data:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Review assignment (consultant only)
  app.post("/api/exercise-assignments/:id/review", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { score, feedback, questionGrades } = req.body;

      // Check if assignment exists and verify ownership
      const existingAssignment = await storage.getExerciseAssignment(req.params.id);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (existingAssignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get exercise to check if it's an exam with autoCorrect
      const exercise = await storage.getExercise(existingAssignment.exerciseId);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      let finalScore = score;
      let finalQuestionGrades = questionGrades;

      // Handle exam with autoCorrect and questionGrades
      if (exercise.isExam && exercise.autoCorrect && questionGrades && Array.isArray(questionGrades)) {
        // Validate all scores are valid (>= 0 and <= maxScore)
        for (const grade of questionGrades) {
          if (grade.score < 0 || grade.score > grade.maxScore) {
            return res.status(400).json({ 
              message: `Invalid score for question ${grade.questionId}: must be between 0 and ${grade.maxScore}` 
            });
          }
        }

        // Calculate finalScore by summing all scores
        finalScore = questionGrades.reduce((sum, grade) => sum + grade.score, 0);
      } else {
        // For non-exam or non-autoCorrect exercises, use the provided score
        if (!finalScore || finalScore < 0 || finalScore > 100) {
          return res.status(400).json({ message: "Score must be between 0 and 100" });
        }
      }

      const assignment = await storage.reviewAssignment(req.params.id, {
        score: finalScore,
        consultantFeedback: feedback,
        status: 'completed',
        reviewedAt: new Date(),
        questionGrades: finalQuestionGrades,
      }, req.user!.id);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Auto-complete linked university lesson if exists
      const linkedLesson = await db.select()
        .from(schema.universityLessons)
        .where(eq(schema.universityLessons.exerciseId, assignment.exerciseId));

      if (linkedLesson.length > 0) {
        const lessonId = linkedLesson[0].id;
        const clientId = assignment.clientId;

        // Update or create lesson progress
        const existingProgress = await db.select()
          .from(schema.universityProgress)
          .where(and(
            eq(schema.universityProgress.lessonId, lessonId),
            eq(schema.universityProgress.clientId, clientId)
          ));

        if (existingProgress.length > 0) {
          await db.update(schema.universityProgress)
            .set({ 
              isCompleted: true, 
              completedAt: new Date(),
              notes: "Completato automaticamente dopo completamento esercizio collegato"
            })
            .where(eq(schema.universityProgress.id, existingProgress[0].id));
        } else {
          await db.insert(schema.universityProgress).values({
            clientId,
            lessonId,
            isCompleted: true,
            completedAt: new Date(),
            notes: "Completato automaticamente dopo completamento esercizio collegato"
          });
        }
      }

      res.json({ message: "Exercise completed successfully", assignment });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // New endpoint for returning exercise to client
  app.post("/api/exercise-assignments/:id/return", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { feedback } = req.body;

      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ message: "Feedback is required when returning exercise to client" });
      }

      // Check if assignment exists and verify ownership
      const existingAssignment = await storage.getExerciseAssignment(req.params.id);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (existingAssignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const assignment = await storage.returnAssignmentToClient(req.params.id, {
        consultantFeedback: feedback,
        status: 'returned',
        reviewedAt: new Date(),
      }, req.user!.id);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Exercise returned to client", assignment });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // New endpoint for rejecting exercise
  app.post("/api/exercise-assignments/:id/reject", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { feedback } = req.body;

      if (!feedback || !feedback.trim()) {
        return res.status(400).json({ message: "Feedback is required when rejecting exercise" });
      }

      // Check if assignment exists and can be rejected
      const existingAssignment = await storage.getExerciseAssignment(req.params.id);
      if (!existingAssignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (existingAssignment.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (existingAssignment.status !== 'submitted') {
        return res.status(409).json({ message: "Exercise can only be rejected when in 'submitted' status" });
      }

      const assignment = await storage.rejectAssignment(req.params.id, {
        consultantFeedback: feedback,
        reviewedAt: new Date(),
      }, req.user!.id);

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      res.json({ message: "Exercise rejected", assignment });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get revision history for an assignment
  app.get("/api/exercise-assignments/:id/revision-history", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if assignment exists and verify permissions
      const assignment = await storage.getExerciseAssignment(req.params.id);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // Check if user has access to this assignment
      const hasAccess = (req.user!.role === "client" && assignment.clientId === req.user!.id) ||
                        (req.user!.role === "consultant" && assignment.consultantId === req.user!.id);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const revisionHistory = await storage.getRevisionHistoryByAssignment(req.params.id);
      res.json(revisionHistory);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Start public exercise (creates an assignment for the client)
  app.post("/api/exercises/public/:exerciseId/start", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { exerciseId } = req.params;

      // Check if exercise exists and is public
      const exercise = await storage.getExercise(exerciseId);
      if (!exercise) {
        return res.status(404).json({ message: "Exercise not found" });
      }

      if (!exercise.isPublic) {
        return res.status(403).json({ message: "Exercise is not public" });
      }

      // Check if client already has an assignment for this exercise
      const existingAssignment = await storage.getPublicExerciseAssignment(exerciseId, req.user!.id);
      if (existingAssignment) {
        return res.json({ assignment: existingAssignment, message: "Exercise already started" });
      }

      // Create assignment for public exercise
      const assignment = await storage.createExerciseAssignment({
        exerciseId: exerciseId,
        clientId: req.user!.id,
        consultantId: exercise.createdBy,
        dueDate: null,
        status: "pending"
      });

      res.status(201).json({ assignment, message: "Public exercise started successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Exercise submission routes
  app.post("/api/exercise-submissions", authenticateToken, requireRole("client"), upload.array('attachments'), async (req: AuthRequest, res) => {
    try {
      const submissionData = {
        ...req.body,
        answers: req.body.answers ? JSON.parse(req.body.answers) : [],
      };

      const validatedData = insertExerciseSubmissionSchema.parse(submissionData);

      // Handle file attachments
      const attachments = req.files ? (req.files as any[]).map((file: any) => file.filename) : [];

      const submission = await storage.createExerciseSubmission({
        ...validatedData,
        attachments,
        submittedAt: new Date(), // Add submission timestamp
      });

      // Get assignment and exercise details for auto-grading
      const assignment = await storage.getExerciseAssignment(validatedData.assignmentId);
      if (!assignment) {
        throw new Error("Assignment not found");
      }

      const exercise = await storage.getExercise(assignment.exerciseId);
      if (!exercise) {
        throw new Error("Exercise not found");
      }

      // Auto-grade exam if autoCorrect is enabled
      let autoGradedScore = null;
      let questionGrades: Array<{questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string}> = [];
      
      if (exercise.isExam && exercise.autoCorrect && exercise.questions && exercise.questions.length > 0) {
        let totalAutoScore = 0;
        let totalAutoPoints = 0;

        for (const question of exercise.questions) {
          const answer = validatedData.answers.find((a: any) => a.questionId === question.id);
          const questionPoints = question.points || 1; // Default to 1 point if not specified

          // Auto-grade only specific question types
          if (question.type === 'true_false' || question.type === 'multiple_choice' || question.type === 'multiple_answer') {
            totalAutoPoints += questionPoints;

            if (!answer) {
              // No answer provided - 0 points
              questionGrades.push({
                questionId: question.id,
                score: 0,
                maxScore: questionPoints,
                isCorrect: false,
                feedback: "Nessuna risposta fornita"
              });
            } else {
              // Check if answer is correct
              let isCorrect = false;

              if (question.type === 'true_false') {
                // True/False question - normalize both student answer and correct answer
                let studentAnswer = typeof answer.answer === 'string' ? answer.answer : String(answer.answer);
                studentAnswer = studentAnswer.toLowerCase();
                
                // Map Italian to English for comparison
                if (studentAnswer === 'vero') studentAnswer = 'true';
                if (studentAnswer === 'falso') studentAnswer = 'false';
                
                // Normalize correct answers
                const normalizedCorrectAnswers = question.correctAnswers?.map((ca: string) => {
                  let normalized = String(ca).toLowerCase();
                  if (normalized === 'vero') normalized = 'true';
                  if (normalized === 'falso') normalized = 'false';
                  return normalized;
                }) || [];
                
                isCorrect = normalizedCorrectAnswers.includes(studentAnswer);
              } else if (question.type === 'multiple_choice') {
                // Single answer question
                const studentAnswer = typeof answer.answer === 'string' ? answer.answer : String(answer.answer);
                isCorrect = question.correctAnswers?.includes(studentAnswer) || false;
              } else if (question.type === 'multiple_answer') {
                // Multiple answer question - must match all correct answers
                const studentAnswers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
                const correctAnswers = question.correctAnswers || [];
                
                // Check if arrays have same length and all correct answers are in student's answers
                isCorrect = studentAnswers.length === correctAnswers.length && 
                           correctAnswers.every((ca: string) => studentAnswers.includes(ca)) &&
                           studentAnswers.every((sa: string) => correctAnswers.includes(sa));
              }

              const earnedScore = isCorrect ? questionPoints : 0;
              totalAutoScore += earnedScore;

              questionGrades.push({
                questionId: question.id,
                score: earnedScore,
                maxScore: questionPoints,
                isCorrect,
                feedback: isCorrect ? "Risposta corretta" : "Risposta errata"
              });
            }
          } else {
            // Manual grading required for open questions
            questionGrades.push({
              questionId: question.id,
              score: 0,
              maxScore: questionPoints,
              isCorrect: undefined, // Indicates manual review needed
              feedback: "Richiede revisione manuale"
            });
          }
        }

        // Calculate auto-graded score as percentage (if there are auto-gradable questions)
        if (totalAutoPoints > 0) {
          autoGradedScore = Math.round((totalAutoScore / totalAutoPoints) * 100);
        }
      }

      // Update assignment with auto-grading results and exam timestamp
      const updateData: any = {
        status: "submitted"
      };

      if (exercise.isExam) {
        updateData.examSubmittedAt = new Date();
        
        if (exercise.autoCorrect && autoGradedScore !== null) {
          updateData.autoGradedScore = autoGradedScore;
          updateData.questionGrades = questionGrades;
        }
      }

      await db.update(schema.exerciseAssignments)
        .set(updateData)
        .where(eq(schema.exerciseAssignments.id, validatedData.assignmentId));

      res.status(201).json({
        submission,
        autoGradedScore,
        questionGrades: questionGrades.length > 0 ? questionGrades : undefined
      });

      // Trigger async File Search sync for this exercise response (privacy-isolated to client's private store)
      if (submission.id && assignment.clientId && assignment.consultantId) {
        fileSearchSyncService.syncClientExerciseResponse(submission.id, assignment.clientId, assignment.consultantId).catch(err => {
          console.error('[Routes] Failed to sync exercise response to File Search:', err);
        });
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get submission by assignment ID
  app.get("/api/exercise-submissions/assignment/:assignmentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { assignmentId } = req.params;
      const submission = await storage.getExerciseSubmissionByAssignment(assignmentId);

      if (!submission) {
        return res.status(404).json({ message: "No submission found for this assignment" });
      }

      // Check permissions
      if (req.user!.role === "client") {
        // Check if this is the client's assignment
        const assignment = await storage.getExerciseAssignment(req.params.assignmentId);
        if (!assignment || assignment.clientId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user!.role === "consultant") {
        // Check if this is the consultant's assignment
        const assignment = await storage.getExerciseAssignment(req.params.assignmentId);
        if (!assignment || assignment.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(submission);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all submissions by assignment ID
  app.get("/api/exercise-submissions/assignment/:assignmentId/all", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { assignmentId } = req.params;
      const submissions = await storage.getSubmissionsByAssignment(assignmentId);

      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Draft submission routes
  app.put("/api/exercise-submissions/draft", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      console.log('========== DRAFT ROUTE DEBUG START ==========');
      console.log('1. Raw request body received:', JSON.stringify(req.body, null, 2));
      console.log('2. User ID:', req.user?.id);

      const validatedData = insertExerciseDraftSchema.parse(req.body);
      console.log('3. Validated data after schema parsing:', JSON.stringify(validatedData, null, 2));

      // Check if user owns this assignment
      const assignment = await storage.getExerciseAssignment(validatedData.assignmentId);
      console.log('4. Assignment found:', !!assignment);
      console.log('5. Assignment clientId:', assignment?.clientId);
      console.log('6. Request user ID:', req.user!.id);

      if (!assignment) {
        console.log('7. ASSIGNMENT NOT FOUND - returning 404');
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (assignment.clientId !== req.user!.id) {
        console.log('7. ACCESS DENIED - assignment ownership mismatch');
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow draft save only for pending, in_progress, or returned status
      const allowedStatuses = ['pending', 'in_progress', 'returned'];
      if (!allowedStatuses.includes(assignment.status)) {
        console.log('8. DRAFT SAVE DENIED - assignment status not allowed:', assignment.status);
        return res.status(403).json({ message: "Cannot save draft for completed/submitted assignments" });
      }

      console.log('8. Calling storage.saveDraftSubmission...');
      // Save draft submission
      const draft = await storage.saveDraftSubmission(validatedData);
      console.log('9. Draft saved, returning response:', JSON.stringify(draft, null, 2));
      console.log('========== DRAFT ROUTE DEBUG END ==========');

      res.json(draft);
    } catch (error: any) {
      console.error('DRAFT ROUTE ERROR:', error);
      console.error('Error stack:', error.stack);
      console.log('========== DRAFT ROUTE DEBUG END (ERROR) ==========');
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/exercise-submissions/draft/:assignmentId", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      console.log('========== GET DRAFT ROUTE DEBUG START ==========');
      const { assignmentId } = req.params;
      console.log('1. Getting draft for assignmentId:', assignmentId);
      console.log('2. User ID:', req.user?.id);
      console.log('3. Request headers:', req.headers);
      console.log('4. Request timestamp:', new Date().toISOString());

      // Check if user owns this assignment
      console.log('5. Checking assignment ownership...');
      const assignment = await storage.getExerciseAssignment(assignmentId);
      console.log('6. Assignment found:', !!assignment);
      console.log('7. Assignment details:', assignment ? {
        id: assignment.id,
        clientId: assignment.clientId,
        exerciseId: assignment.exerciseId,
        status: assignment.status,
        createdAt: assignment.createdAt
      } : 'null');

      if (!assignment) {
        console.log('8. ASSIGNMENT NOT FOUND - returning 404');
        return res.status(404).json({ message: "Assignment not found" });
      }

      if (assignment.clientId !== req.user!.id) {
        console.log('8. ACCESS DENIED - assignment ownership mismatch');
        console.log('   - Assignment clientId:', assignment?.clientId);
        console.log('   - Request user ID:', req.user!.id);
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow draft access only for pending, in_progress, or returned status
      const allowedStatuses = ['pending', 'in_progress', 'returned'];
      if (!allowedStatuses.includes(assignment.status)) {
        console.log('8. DRAFT ACCESS DENIED - assignment status not allowed:', assignment.status);
        return res.status(403).json({ message: "Cannot access draft for completed/submitted assignments" });
      }

      console.log('9. Access granted, calling storage.getDraftSubmission...');
      // Get draft submission
      const draft = await storage.getDraftSubmission(assignmentId);
      console.log('10. Draft retrieved from storage:', !!draft);

      if (draft) {
        console.log('11. Draft details from storage:', {
          id: draft.id,
          assignmentId: draft.assignmentId,
          answers: {
            type: typeof draft.answers,
            isArray: Array.isArray(draft.answers),
            length: draft.answers?.length || 0,
            content: draft.answers
          },
          notes: {
            type: typeof draft.notes,
            length: draft.notes?.length || 0,
            content: draft.notes
          },
          submittedAt: draft.submittedAt,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt
        });
      }

      if (!draft) {
        console.log('12. No draft found, returning 404');
        console.log('========== GET DRAFT ROUTE DEBUG END (NOT FOUND) ==========');
        return res.status(404).json({ message: "No draft found for this assignment" });
      }

      console.log('13. Preparing response...');
      const response = {
        id: draft.id,
        assignmentId: draft.assignmentId,
        answers: draft.answers,
        notes: draft.notes,
        attachments: draft.attachments,
        submittedAt: draft.submittedAt,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt
      };

      console.log('14. Sending response:', JSON.stringify(response, null, 2));
      console.log('========== GET DRAFT ROUTE DEBUG END (SUCCESS) ==========');
      res.json(response);
    } catch (error: any) {
      console.error('💥 GET DRAFT ROUTE ERROR:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.log('========== GET DRAFT ROUTE DEBUG END (ERROR) ==========');
      res.status(500).json({ message: error.message });
    }
  });

  // Client routes
  app.get("/api/clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const clients = await storage.getClientsByConsultant(req.user!.id, activeOnly);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new client (consultant only)
  app.post("/api/clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;

      // Validate required fields for email (always needed)
      if (!email) {
        return res.status(400).json({ message: "L'email è obbligatoria" });
      }

      // Check if user already exists FIRST
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // EMAIL CONDIVISA: Check if user already has a client profile for this consultant
        const existingProfiles = await storage.getUserRoleProfiles(existingUser.id);
        const hasClientProfileForThisConsultant = existingProfiles.some(
          p => p.role === 'client' && p.consultantId === req.user!.id
        );

        if (hasClientProfileForThisConsultant) {
          return res.status(400).json({ 
            message: "Questo utente è già un tuo cliente" 
          });
        }

        // Add new client profile for existing user
        await storage.createUserRoleProfile({
          userId: existingUser.id,
          role: 'client',
          consultantId: req.user!.id,
          isDefault: false,
          isActive: true,
        });

        // Initialize email automation and client state tracking for the new profile
        try {
          await storage.upsertClientEmailAutomation({
            consultantId: req.user!.id,
            clientId: existingUser.id,
            enabled: false,
          });

          await storage.upsertClientState({
            clientId: existingUser.id,
            consultantId: req.user!.id,
            currentState: `Nuovo cliente - ${existingUser.firstName} sta iniziando il percorso`,
            idealState: `Da definire durante la prima consulenza`,
            internalBenefit: null,
            externalBenefit: null,
            mainObstacle: null,
            pastAttempts: null,
            currentActions: null,
            futureVision: null,
            motivationDrivers: null,
          });
        } catch (initError: any) {
          console.error(`⚠️  [NEW CLIENT PROFILE] Failed to initialize records:`, initError.message);
        }

        return res.status(201).json({
          message: "Profilo cliente aggiunto con successo",
          user: {
            id: existingUser.id,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            email: existingUser.email,
            username: existingUser.username,
            role: "client",
          },
          isExistingUser: true,
        });
      }

      // For NEW users: validate all required fields
      if (!firstName || !lastName || !password) {
        return res.status(400).json({ message: "Nome, cognome e password sono obbligatori" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "La password deve essere di almeno 6 caratteri" });
      }

      // Generate username from email
      const username = email.split('@')[0] + '_' + Date.now().toString().slice(-4);

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create client user
      const user = await storage.createUser({
        firstName,
        lastName,
        email,
        username,
        password: hashedPassword,
        role: "client",
        consultantId: req.user!.id,
      });

      // Create default client profile for new user
      await storage.createUserRoleProfile({
        userId: user.id,
        role: 'client',
        consultantId: req.user!.id,
        isDefault: true,
        isActive: true,
      });

      // Initialize email automation and client state tracking
      try {
        await storage.upsertClientEmailAutomation({
          consultantId: req.user!.id,
          clientId: user.id,
          enabled: false,
        });

        await storage.upsertClientState({
          clientId: user.id,
          consultantId: req.user!.id,
          currentState: `Nuovo cliente - ${firstName} sta iniziando il percorso`,
          idealState: `Da definire durante la prima consulenza`,
          internalBenefit: null,
          externalBenefit: null,
          mainObstacle: null,
          pastAttempts: null,
          currentActions: null,
          futureVision: null,
          motivationDrivers: null,
        });
      } catch (initError: any) {
        console.error(`⚠️  [NEW CLIENT] Failed to initialize records:`, initError.message);
      }

      res.status(201).json({
        message: "Cliente creato con successo",
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Client creation error:", error);
      res.status(400).json({ message: error.message || "Errore durante la creazione del cliente" });
    }
  });

  // Update user (for phone number, etc.)
  app.patch("/api/users/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { phone_number, gemini_api_keys, firstName, lastName, email, username, phoneNumber: existingPhoneNumber, isActive, ...otherUpdates } = req.body;
      
      // Map snake_case to camelCase for database
      const updates: any = {};
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (username !== undefined) updates.username = username;
      if (phone_number !== undefined) updates.phoneNumber = phone_number;
      if (gemini_api_keys !== undefined) updates.geminiApiKeys = gemini_api_keys;
      if (isActive !== undefined) updates.isActive = isActive;

      // Check if user is updating their own profile or consultant updating client
      const targetUser = await storage.getUser(id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Allow user to update own profile
      if (req.user!.id === id) {
        const updatedUser = await storage.updateUser(id, updates);
        return res.json(updatedUser);
      }

      // Allow consultant to update their clients
      if (req.user!.role === "consultant" && targetUser.role === "client" && targetUser.consultantId === req.user!.id) {
        const updatedUser = await storage.updateUser(id, updates);
        return res.json(updatedUser);
      }

      return res.status(403).json({ message: "Access denied" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Consultants route (public for registration)
  app.get("/api/consultants", async (req, res) => {
    try {
      const users = await storage.getUsersByRole("consultant");
      const consultants = users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      }));
      res.json(consultants);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Consultation routes
  app.post("/api/consultations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertConsultationSchema.parse({
        ...req.body,
        consultantId: req.user!.id,
      });

      const consultation = await storage.createConsultation(validatedData);
      res.status(201).json(consultation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/consultations/client", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const consultations = await storage.getConsultationsByClient(req.user!.id);
      res.json(consultations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/consultations/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultations = await storage.getConsultationsByConsultant(req.user!.id);
      res.json(consultations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/consultations/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const consultation = await storage.getConsultation(req.params.id);
      if (!consultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      // Check if user has access to this consultation
      const hasAccess = consultation.clientId === req.user!.id || 
                       (req.user!.role === "consultant" && consultation.consultantId === req.user!.id);

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(consultation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/consultations/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if consultation exists and belongs to this consultant
      const existingConsultation = await storage.getConsultation(req.params.id);
      if (!existingConsultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      if (existingConsultation.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = updateConsultationSchema.parse(req.body);
      const updatedConsultation = await storage.updateConsultation(req.params.id, validatedData);

      if (!updatedConsultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      res.json(updatedConsultation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/consultations/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if consultation exists and belongs to this consultant
      const existingConsultation = await storage.getConsultation(req.params.id);
      if (!existingConsultation) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      if (existingConsultation.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const deleted = await storage.deleteConsultation(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Calendar appointments endpoint - combines Google Calendar + WhatsApp bookings
  app.get("/api/calendar/appointments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      
      // 1. Get Google Calendar events (next 90 days)
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);
      
      const googleEvents = await googleCalendarService.listEvents(consultantId, now, futureDate);
      
      // 2. Get WhatsApp appointment bookings
      const whatsappBookings = await db
        .select()
        .from(schema.appointmentBookings)
        .where(
          and(
            eq(schema.appointmentBookings.consultantId, consultantId),
            gte(schema.appointmentBookings.appointmentDate, now.toISOString().split('T')[0])
          )
        );
      
      // 3. Combine into unified format
      const appointments = [];
      
      // Add Google Calendar events
      for (const event of googleEvents) {
        appointments.push({
          id: `google-${event.start.getTime()}`,
          title: event.summary,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          backgroundColor: '#4285f4',
          borderColor: '#4285f4',
          extendedProps: {
            source: 'google_calendar',
            status: event.status,
          },
        });
      }
      
      // Add WhatsApp bookings
      for (const booking of whatsappBookings) {
        const startDateTime = new Date(`${booking.appointmentDate}T${booking.appointmentTime}`);
        const endDateTime = booking.appointmentEndTime 
          ? new Date(`${booking.appointmentDate}T${booking.appointmentEndTime}`)
          : new Date(startDateTime.getTime() + 60 * 60000); // Default 1 hour
        
        appointments.push({
          id: `whatsapp-${booking.id}`,
          title: `WhatsApp: ${booking.clientPhone}`,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          backgroundColor: booking.status === 'confirmed' ? '#25d366' : '#ffa500',
          borderColor: booking.status === 'confirmed' ? '#25d366' : '#ffa500',
          extendedProps: {
            source: 'whatsapp',
            phone: booking.clientPhone,
            status: booking.status,
            googleEventId: booking.googleEventId,
          },
        });
      }
      
      res.json(appointments);
    } catch (error: any) {
      console.error('Error fetching calendar appointments:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate consultation summary email
  app.post("/api/consultations/:id/generate-summary-email", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    const startTime = Date.now();
    try {
      const consultationId = req.params.id;
      const { additionalNotes } = req.body; // Appunti extra opzionali per contesto AI (non salvati)
      
      console.log(`📋 [CONSULTATION SUMMARY] Request to generate summary email for consultation ${consultationId}`);
      
      // 1. Verifica che la consulenza esista e appartenga al consultant
      const consultation = await storage.getConsultation(consultationId);
      if (!consultation) {
        return res.status(404).json({ message: "Consulenza non trovata" });
      }
      
      if (consultation.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Accesso negato" });
      }
      
      // 2. Verifica che la consulenza sia completata
      if (consultation.status !== "completed") {
        return res.status(400).json({ 
          message: "La consulenza deve essere completata prima di generare l'email di riepilogo" 
        });
      }
      
      // 3. Verifica che ci sia una trascrizione Fathom
      if (!consultation.transcript) {
        return res.status(400).json({ 
          message: "Nessuna trascrizione Fathom disponibile per questa consulenza" 
        });
      }
      
      // 4. Controlla duplicati: verifica se esiste già una bozza pending/approved
      const existingDraft = await storage.checkExistingConsultationSummaryDraft(consultationId);
      if (existingDraft) {
        return res.status(409).json({ 
          message: "Esiste già una bozza email di riepilogo per questa consulenza",
          draftId: existingDraft.id,
          status: existingDraft.status
        });
      }
      
      // 5. Controlla se l'email è già stata inviata
      const alreadySent = await storage.checkConsultationSummaryAlreadySent(consultationId);
      if (alreadySent.sent) {
        return res.status(409).json({ 
          message: "L'email di riepilogo per questa consulenza è già stata inviata",
          sentAt: alreadySent.sentAt
        });
      }
      
      // 6. Recupera i dati necessari
      const client = await storage.getUser(consultation.clientId);
      const consultant = await storage.getUser(consultation.consultantId);
      
      if (!client || !consultant) {
        return res.status(404).json({ message: "Cliente o consulente non trovato" });
      }
      
      // 7. Genera l'email con AI
      const aiStartTime = Date.now();
      console.log(`🤖 [TIMER] Starting AI email generation at +${aiStartTime - startTime}ms`);
      const generatedEmail = await generateConsultationSummaryEmail({
        consultationId: consultation.id,
        clientId: client.id,
        consultantId: consultant.id,
        clientName: client.firstName,
        consultantName: consultant.firstName,
        consultationDate: consultation.scheduledAt,
        fathomTranscript: consultation.transcript, // FIX: Use correct database field name
        fathomShareLink: consultation.fathomShareLink || undefined,
        googleMeetLink: consultation.googleMeetLink || undefined,
        consultationNotes: consultation.notes || undefined,
        additionalNotes: additionalNotes || undefined, // Usati solo come contesto AI, non salvati
      });
      const aiEndTime = Date.now();
      console.log(`✅ [TIMER] AI generation completed in ${aiEndTime - aiStartTime}ms (total: ${aiEndTime - startTime}ms)`);
      
      // 8. Salva la bozza nel database
      const draftStartTime = Date.now();
      console.log(`💾 [TIMER] Starting draft save at +${draftStartTime - startTime}ms`);
      const draft = await storage.createEmailDraft({
        consultantId: consultant.id,
        clientId: client.id,
        consultationId: consultation.id, // Link alla consulenza
        emailType: "consultation_summary",
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        preview: generatedEmail.preview,
        status: "pending", // Sempre pending, mai auto-inviato
        generatedAt: new Date(),
        metadata: {
          consultationDate: consultation.scheduledAt.toISOString(),
          fathomShareLink: consultation.fathomShareLink,
          googleMeetLink: consultation.googleMeetLink,
        }
      });
      
      const draftEndTime = Date.now();
      console.log(`✅ [TIMER] Draft saved in ${draftEndTime - draftStartTime}ms (draft ID: ${draft.id}, total: ${draftEndTime - startTime}ms)`);
      
      // 9. Rispondi IMMEDIATAMENTE al client per evitare timeout
      const responseTime = Date.now();
      res.status(201).json({
        message: "Bozza email di riepilogo generata con successo",
        draft: draft
      });
      console.log(`📤 [TIMER] Response sent to client at +${responseTime - startTime}ms (BEFORE consultation update to avoid timeout)`);
      
      // 10. Salva l'email anche nella consulenza per uso AI (in background, dopo la risposta)
      const updateStartTime = Date.now();
      console.log(`💾 [TIMER] Starting consultation update at +${updateStartTime - startTime}ms (background, after response)`);
      try {
        await storage.updateConsultation(consultation.id, {
          summaryEmail: generatedEmail.body,
          summaryEmailGeneratedAt: new Date(),
          summaryEmailStatus: "draft",
          summaryEmailDraft: JSON.stringify({
            subject: generatedEmail.subject,
            body: generatedEmail.body,
            preview: generatedEmail.preview,
          }),
        });
        const updateEndTime = Date.now();
        console.log(`✅ [TIMER] Consultation updated in ${updateEndTime - updateStartTime}ms (total: ${updateEndTime - startTime}ms)`);
        console.log(`🏁 [TIMER] Full operation completed in ${updateEndTime - startTime}ms (AI: ${aiEndTime - aiStartTime}ms, Draft: ${draftEndTime - draftStartTime}ms, Update: ${updateEndTime - updateStartTime}ms)`);
      } catch (updateError: any) {
        // Log error but don't fail the request (draft is already saved and response sent)
        console.error(`⚠️ Failed to update consultation with summary email:`, updateError);
      }
      
    } catch (error: any) {
      console.error(`❌ Error generating consultation summary email:`, error);
      res.status(500).json({ 
        message: "Errore durante la generazione dell'email di riepilogo",
        error: error.message 
      });
    }
  });

  // Goal routes
  app.post("/api/goals", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertGoalSchema.parse({
        ...req.body,
        clientId: req.user!.id,
      });

      const goal = await storage.createGoal(validatedData);
      res.status(201).json(goal);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/goals", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const goals = await storage.getGoalsByClient(req.user!.id);
      res.json(goals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Daily Tasks routes
  app.post("/api/daily-tasks", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;

      console.log('Daily task creation - raw body:', req.body);
      console.log('User info:', { id: user.id, consultantId: user.consultantId });

      // Get the full user data to access consultantId
      const fullUser = await storage.getUser(user.id);

      if (!fullUser || !fullUser.consultantId) {
        return res.status(400).json({ 
          message: 'No consultant assigned to this client. Please contact support.' 
        });
      }

      const validatedData = insertDailyTaskSchema.parse({
        ...req.body,
        clientId: user.id,
        consultantId: fullUser.consultantId,
      });

      console.log('Validated data:', validatedData);

      const task = await storage.createDailyTask(validatedData);
      res.status(201).json(task);
    } catch (error: any) {
      console.error('Daily task creation error:', error);
      if (error.name === 'ZodError') {
        console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: error.errors 
        });
      }
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/daily-tasks", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      const tasks = await storage.getDailyTasksByClient(
        req.user!.id,
        startDate as string,
        endDate as string
      );
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/daily-tasks/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientId, startDate, endDate } = req.query;
      const tasks = await storage.getDailyTasksByConsultant(
        req.user!.id,
        clientId as string,
        startDate as string,
        endDate as string
      );
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/daily-tasks/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const updatedTask = await storage.updateDailyTask(req.params.id, req.body);
      if (!updatedTask) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(updatedTask);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/daily-tasks/:id", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteDailyTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Daily Reflections routes
  app.post("/api/daily-reflections", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const user = req.user!;

      // Get the full user data to access consultantId
      const fullUser = await storage.getUser(user.id);

      if (!fullUser || !fullUser.consultantId) {
        return res.status(400).json({ 
          message: 'No consultant assigned to this client. Please contact support.' 
        });
      }

      const validatedData = insertDailyReflectionSchema.parse({
        ...req.body,
        clientId: user.id,
        consultantId: fullUser.consultantId,
      });

      const reflection = await storage.createDailyReflection(validatedData);
      res.status(201).json(reflection);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/daily-reflections", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      const reflections = await storage.getDailyReflectionsByClient(
        req.user!.id,
        startDate as string,
        endDate as string
      );
      res.json(reflections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/daily-reflections/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientId, startDate, endDate } = req.query;
      const reflections = await storage.getDailyReflectionsByConsultant(
        req.user!.id,
        clientId as string,
        startDate as string,
        endDate as string
      );
      res.json(reflections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/daily-reflections/:date", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const reflection = await storage.getDailyReflectionByDate(req.user!.id, req.params.date);
      if (!reflection) {
        return res.status(404).json({ message: "Reflection not found" });
      }
      res.json(reflection);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/daily-reflections/:id", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const updatedReflection = await storage.updateDailyReflection(req.params.id, req.body);
      if (!updatedReflection) {
        return res.status(404).json({ message: "Reflection not found" });
      }
      res.json(updatedReflection);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/daily-reflections/:id", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteDailyReflection(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Reflection not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Progress routes
  app.post("/api/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertClientProgressSchema.parse({
        ...req.body,
        clientId: req.user!.id,
      });

      const progress = await storage.createClientProgress(validatedData);
      res.status(201).json(progress);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const progress = await storage.getClientProgress(req.user!.id);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Roadmap routes

  // Roadmap Phases
  app.post("/api/roadmap/phases", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRoadmapPhaseSchema.parse(req.body);
      const phase = await storage.createRoadmapPhase(validatedData);
      res.status(201).json(phase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/phases", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const phases = await storage.getRoadmapPhases();
      res.json(phases);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/phases/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const phase = await storage.getRoadmapPhase(req.params.id);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }
      res.json(phase);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roadmap/phases/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertRoadmapPhaseSchema.partial().parse(req.body);
      const updatedPhase = await storage.updateRoadmapPhase(req.params.id, updates);

      if (!updatedPhase) {
        return res.status(404).json({ message: "Phase not found" });
      }

      res.json(updatedPhase);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/roadmap/phases/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if phase has dependent groups
      const groups = await storage.getRoadmapGroupsByPhase(req.params.id);
      if (groups.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete phase with existing groups. Delete groups first." 
        });
      }

      const phase = await storage.getRoadmapPhase(req.params.id);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }

      // Delete the phase
      await db.delete(schema.roadmapPhases).where(eq(schema.roadmapPhases.id, req.params.id));

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Roadmap Groups
  app.post("/api/roadmap/groups", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRoadmapGroupSchema.parse(req.body);

      // Verify phase exists
      const phase = await storage.getRoadmapPhase(validatedData.phaseId);
      if (!phase) {
        return res.status(404).json({ message: "Phase not found" });
      }

      const group = await storage.createRoadmapGroup(validatedData);
      res.status(201).json(group);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/phases/:phaseId/groups", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const groups = await storage.getRoadmapGroupsByPhase(req.params.phaseId);
      res.json(groups);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/groups/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const group = await storage.getRoadmapGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roadmap/groups/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertRoadmapGroupSchema.partial().parse(req.body);

      // If updating phaseId, verify the new phase exists
      if (updates.phaseId) {
        const phase = await storage.getRoadmapPhase(updates.phaseId);
        if (!phase) {
          return res.status(404).json({ message: "Phase not found" });
        }
      }

      const updatedGroup = await storage.updateRoadmapGroup(req.params.id, updates);

      if (!updatedGroup) {
        return res.status(404).json({ message: "Group not found" });
      }

      res.json(updatedGroup);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/roadmap/groups/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if group has dependent items
      const items = await storage.getRoadmapItemsByGroup(req.params.id);
      if (items.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete group with existing items. Delete items first." 
        });
      }

      const group = await storage.getRoadmapGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Delete the group
      await db.delete(schema.roadmapGroups).where(eq(schema.roadmapGroups.id, req.params.id));

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Roadmap Items
  app.post("/api/roadmap/items", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertRoadmapItemSchema.parse(req.body);

      // Verify group exists
      const group = await storage.getRoadmapGroup(validatedData.groupId);
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const item = await storage.createRoadmapItem(validatedData);
      res.status(201).json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/groups/:groupId/items", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const items = await storage.getRoadmapItemsByGroup(req.params.groupId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/items/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roadmap/items/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertRoadmapItemSchema.partial().parse(req.body);

      // If updating groupId, verify the new group exists
      if (updates.groupId) {
        const group = await storage.getRoadmapGroup(updates.groupId);
        if (!group) {
          return res.status(404).json({ message: "Group not found" });
        }
      }

      const updatedItem = await storage.updateRoadmapItem(req.params.id, updates);

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/roadmap/items/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Check if item has associated progress records
      // Note: We allow deletion even with progress records as they will cascade delete due to foreign key
      // This is a design decision - consultants can remove items from roadmap

      // Delete the item (progress records will cascade delete due to foreign key)
      await db.delete(schema.roadmapItems).where(eq(schema.roadmapItems.id, req.params.id));

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update roadmap item external link
  app.patch("/api/roadmap/items/:id/external-link", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { externalLink, externalLinkTitle } = req.body;

      const item = await storage.getRoadmapItem(req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const updatedItem = await storage.updateRoadmapItem(req.params.id, {
        externalLink,
        externalLinkTitle
      });

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Client Roadmap Progress
  app.post("/api/roadmap/progress", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let consultantId: string;
      let clientId: string;

      // Determine consultant and client IDs based on user role
      if (req.user!.role === "consultant") {
        consultantId = req.user!.id;
        clientId = req.body.clientId;

        if (!clientId) {
          return res.status(400).json({ message: "clientId is required for consultants" });
        }

        // Verify the client belongs to this consultant
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== consultantId) {
          return res.status(403).json({ message: "Access denied to this client" });
        }
      } else {
        // Client updating their own progress
        clientId = req.user!.id;
        const client = await storage.getUser(clientId);
        consultantId = client?.consultantId || "";

        if (!consultantId) {
          return res.status(400).json({ message: "No consultant assigned to this client" });
        }
      }

      // Parse and convert dates properly
      const bodyData = { ...req.body };
      if (bodyData.completedAt && typeof bodyData.completedAt === 'string') {
        bodyData.completedAt = new Date(bodyData.completedAt);
      }

      const validatedData = insertClientRoadmapProgressSchema.parse({
        ...bodyData,
        clientId,
        consultantId,
      });

      const progress = await storage.createClientRoadmapProgress(validatedData);
      res.status(201).json(progress);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/progress/:clientId/:itemId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId, itemId } = req.params;

      // STRICT access control - clients can ONLY access their own data
      if (req.user!.role === "client") {
        if (req.user!.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user!.role === "consultant") {
        // Consultants can only access their assigned clients
        const client = await storage.getUser(clientId);
        if (!client || client.role !== "client" || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied to this client" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const progress = await storage.getClientRoadmapProgress(clientId, itemId);
      if (!progress) {
        return res.status(404).json({ message: "Progress not found" });
      }

      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/roadmap/progress/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // STRICT access control - clients can ONLY access their own data
      if (req.user!.role === "client") {
        if (req.user!.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user!.role === "consultant") {
        // Consultants can only access their assigned clients
        const client = await storage.getUser(clientId);
        if (!client || client.role !== "client" || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied to this client" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      const progress = await storage.getClientRoadmapProgressAll(clientId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/roadmap/progress/:clientId/:itemId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId, itemId } = req.params;

      // STRICT access control - clients can ONLY access their own data
      if (req.user!.role === "client") {
        if (req.user!.id !== clientId) {
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user!.role === "consultant") {
        // Consultants can only access their assigned clients
        const client = await storage.getUser(clientId);
        if (!client || client.role !== "client" || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied to this client" });
        }
      } else {
        return res.status(403).json({ message: "Access denied" });
      }

      // Parse and convert dates properly
      const bodyData = { ...req.body };
      if (bodyData.completedAt && typeof bodyData.completedAt === 'string') {
        bodyData.completedAt = new Date(bodyData.completedAt);
      }

      const updates = insertClientRoadmapProgressSchema.partial().parse(bodyData);

      // Set completedAt timestamp if marking as completed
      if (updates.isCompleted === true && !updates.completedAt) {
        updates.completedAt = new Date();
      } else if (updates.isCompleted === false) {
        updates.completedAt = null;
      }

      // Try to update existing progress
      let updatedProgress = await storage.updateClientRoadmapProgress(clientId, itemId, updates);

      // If progress doesn't exist, create it
      if (!updatedProgress) {
        const client = await storage.getUser(clientId);
        const consultantId = req.user!.role === "consultant" ? req.user!.id : client?.consultantId;

        if (!consultantId) {
          return res.status(400).json({ message: "No consultant assigned to this client" });
        }

        const progressData = insertClientRoadmapProgressSchema.parse({
          clientId,
          consultantId,
          itemId,
          ...updates,
        });

        updatedProgress = await storage.createClientRoadmapProgress(progressData);
      }

      res.json(updatedProgress);
    } catch (error: any) {
      console.error("Error updating roadmap progress:", error);
      res.status(400).json({ message: error.message });
    }
  });

  // Full Roadmap with Progress
  app.get("/api/roadmap/full/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      console.log("GET /api/roadmap/full/:clientId called:", {
        clientId,
        userId: req.user?.id,
        userRole: req.user?.role,
        timestamp: new Date().toISOString()
      });

      // STRICT access control - clients can ONLY access their own data
      if (req.user!.role === "client") {
        if (req.user!.id !== clientId) {
          console.log("Access denied - client trying to access another client's data");
          return res.status(403).json({ message: "Access denied" });
        }
      } else if (req.user!.role === "consultant") {
        // Consultants can only access their assigned clients
        console.log("Checking consultant access to client...");
        const client = await storage.getUser(clientId);
        console.log("Client data:", {
          exists: !!client,
          role: client?.role,
          consultantId: client?.consultantId,
          requestingConsultantId: req.user!.id
        });

        if (!client || client.role !== "client" || client.consultantId !== req.user!.id) {
          console.log("Access denied - consultant doesn't have access to this client");
          return res.status(403).json({ message: "Access denied to this client" });
        }
      } else {
        console.log("Access denied - invalid role");
        return res.status(403).json({ message: "Access denied" });
      }

      console.log("Access granted, fetching roadmap...");
      const fullRoadmap = await storage.getFullRoadmapWithProgress(clientId);
      console.log("Roadmap fetched successfully, sending response");


      res.json(fullRoadmap);
    } catch (error: any) {
      console.error("Error in /api/roadmap/full/:clientId:", {
        clientId: req.params.clientId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ message: error.message });
    }
  });

  // Consultant Roadmap Overview (for all clients)
  app.get("/api/roadmap/consultant/overview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const overview = await storage.getConsultantRoadmapOverview(req.user!.id);
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cleanup routes
  app.post("/api/cleanup/orphaned-assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const cleanupCount = await storage.cleanupOrphanedAssignments();
      res.json({ 
        message: `Cleaned up ${cleanupCount} orphaned assignments`,
        cleanupCount 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Dashboard stats routes
  app.get("/api/stats/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const clients = await storage.getClientsByConsultant(req.user!.id);
      const assignments = await storage.getAssignmentsByConsultant(req.user!.id);
      const consultations = await storage.getConsultationsByConsultant(req.user!.id);

      const completedExercises = assignments.filter(a => a.status === "completed").length;
      const totalExercises = assignments.length;
      const completionRate = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

      const today = new Date();
      const todayConsultations = consultations.filter(c => {
        const consultationDate = new Date(c.scheduledAt);
        return consultationDate.toDateString() === today.toDateString();
      }).length;

      res.json({
        activeClients: clients.length,
        completedExercises,
        completionRate,
        todayConsultations,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stats/client", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const assignments = await storage.getAssignmentsByClient(req.user!.id);
      const consultations = await storage.getConsultationsByClient(req.user!.id);
      const progress = await storage.getClientProgress(req.user!.id);

      const completedExercises = assignments.filter(a => a.status === "completed").length;
      const totalExercises = assignments.length;

      // Calculate streak (simplified - based on recent progress entries)
      let streak = 0;
      const sortedProgress = progress.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      for (const p of sortedProgress) {
        if (p.exercisesCompleted && p.exercisesCompleted > 0) {
          streak++;
        } else {
          break;
        }
      }

      // Next consultation
      const upcomingConsultations = consultations
        .filter(c => new Date(c.scheduledAt) > new Date())
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

      const nextConsultation = upcomingConsultations[0];

      res.json({
        completedExercises,
        totalExercises,
        streak,
        nextConsultation: nextConsultation ? {
          date: nextConsultation.scheduledAt,
          consultant: nextConsultation.consultant,
        } : null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics routes
  // Consultant overview analytics
  app.get("/api/analytics/consultant/overview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsOverviewQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const stats = await storage.calculateConsultantOverallStats(req.user!.id, start, end);
      res.json(stats);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Exercise completion trends
  app.get("/api/analytics/consultant/completion-trends", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsCompletionTrendsQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const trends = await storage.getExerciseCompletionTrends(
        req.user!.id, 
        validatedQuery.period, 
        start, 
        end
      );
      res.json(trends);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Client engagement trends
  app.get("/api/analytics/consultant/engagement-trends", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsEngagementTrendsQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const trends = await storage.getClientEngagementTrends(
        req.user!.id, 
        validatedQuery.period, 
        start, 
        end
      );
      res.json(trends);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Client performance analytics with pagination
  app.get("/api/analytics/clients/performance", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsClientPerformanceQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;
      const limit = validatedQuery.limit ? parseInt(validatedQuery.limit) : 20;
      const offset = validatedQuery.offset ? parseInt(validatedQuery.offset) : 0;

      if (validatedQuery.clientId) {
        // Get performance for specific client
        const performance = await storage.calculateClientPerformanceStats(
          validatedQuery.clientId, 
          req.user!.id, 
          start, 
          end
        );
        res.json(performance);
      } else {
        // Get performance for all clients with pagination
        const clients = await storage.getClientsByConsultant(req.user!.id);
        const totalClients = clients.length;
        const paginatedClients = clients.slice(offset, offset + limit);

        const allPerformance = await Promise.all(
          paginatedClients.map(async client => {
            const performance = await storage.calculateClientPerformanceStats(
              client.id, 
              req.user!.id, 
              start, 
              end
            );
            return {
              client: {
                id: client.id,
                firstName: client.firstName,
                lastName: client.lastName,
                email: client.email,
                avatar: client.avatar,
              },
              performance,
            };
          })
        );

        res.json({
          data: allPerformance,
          pagination: {
            total: totalClients,
            limit,
            offset,
            hasMore: offset + limit < totalClients
          }
        });
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Exercise performance metrics
  app.get("/api/analytics/exercise-performance", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsExercisePerformanceQuerySchema.parse(req.query);

      const metrics = await storage.getExercisePerformanceMetrics(
        validatedQuery.exerciseId,
        validatedQuery.clientId || undefined,
        validatedQuery.assignmentId || undefined
      );

      res.json(metrics);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Client engagement metrics
  app.get("/api/analytics/client-engagement", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsClientEngagementQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const metrics = await storage.getClientEngagementMetrics(
        validatedQuery.clientId,
        req.user!.id,
        start,
        end
      );

      res.json(metrics);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Consultant analytics summary
  app.get("/api/analytics/consultant/summary", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsConsultantSummaryQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const analytics = await storage.getConsultantAnalytics(
        req.user!.id,
        validatedQuery.period,
        start,
        end
      );

      res.json(analytics);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Client analytics summary
  app.get("/api/analytics/clients/summary", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedQuery = analyticsClientSummaryQuerySchema.parse(req.query);
      const start = validatedQuery.startDate ? new Date(validatedQuery.startDate) : undefined;
      const end = validatedQuery.endDate ? new Date(validatedQuery.endDate) : undefined;

      const summaries = await storage.getClientAnalyticsSummary(
        validatedQuery.clientId,
        req.user!.id,
        validatedQuery.period,
        start,
        end
      );

      res.json(summaries);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Invalid query parameters", 
          errors: error.errors.map((e: any) => ({ field: e.path.join('.'), message: e.message }))
        });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Create/update analytics data endpoints (for data simulation/testing)
  app.post("/api/analytics/client-engagement", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const metricsData = {
        ...req.body,
        consultantId: req.user!.id,
        date: req.body.date ? new Date(req.body.date) : new Date(),
      };

      const metrics = await storage.createClientEngagementMetrics(metricsData);
      res.status(201).json(metrics);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Vertex AI Usage Analytics (accessible by both consultants and clients)
  app.get("/api/analytics/vertex-usage", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userRole = req.user!.role;
      
      // Determine consultantId to filter by
      let consultantIdToFilter: number;
      
      if (userRole === "consultant") {
        // Consultant sees all their clients' analytics
        consultantIdToFilter = req.user!.id;
      } else if (userRole === "client") {
        // Client sees only their sales agents' analytics
        const user = await storage.getUser(req.user!.id);
        if (!user || !user.consultantId) {
          return res.status(403).json({ message: "Client non associato a un consulente" });
        }
        consultantIdToFilter = user.consultantId;
      } else {
        return res.status(403).json({ message: "Accesso non autorizzato" });
      }
      
      // Parse query params for date filtering
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      // Build WHERE conditions
      const whereConditions = [eq(schema.vertexAiUsageTracking.consultantId, consultantIdToFilter)];
      if (startDate) {
        whereConditions.push(gte(schema.vertexAiUsageTracking.createdAt, startDate));
      }
      if (endDate) {
        whereConditions.push(lte(schema.vertexAiUsageTracking.createdAt, endDate));
      }

      // Query aggregated data from vertex_ai_usage_tracking
      const result = await db
        .select({
          totalSessions: sql<number>`COUNT(DISTINCT ${schema.vertexAiUsageTracking.sessionId})`,
          totalApiCalls: sql<number>`COUNT(*)`,
          totalCost: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.totalCost}), 0)`,
          totalTextInputCost: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.textInputCost}), 0)`,
          totalAudioInputCost: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.audioInputCost}), 0)`,
          totalAudioOutputCost: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.audioOutputCost}), 0)`,
          totalCachedInputCost: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.cachedInputCost}), 0)`,
          totalPromptTokens: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.promptTokens}), 0)`,
          totalCandidatesTokens: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.candidatesTokens}), 0)`,
          totalCachedTokens: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.cachedContentTokenCount}), 0)`,
          totalAudioInputSeconds: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.audioInputSeconds}), 0)`,
          totalAudioOutputSeconds: sql<number>`COALESCE(SUM(${schema.vertexAiUsageTracking.audioOutputSeconds}), 0)`,
        })
        .from(schema.vertexAiUsageTracking)
        .where(and(...whereConditions))
        .then(rows => rows[0]);

      // Calculate derived metrics
      const totalInputTokensWithCache = (result.totalPromptTokens || 0) + (result.totalCachedTokens || 0);
      const cacheHitRate = totalInputTokensWithCache > 0 
        ? ((result.totalCachedTokens || 0) / totalInputTokensWithCache) * 100 
        : 0;

      // Calculate cost without cache (what we would have paid at $0.50/1M for cached tokens)
      const PRICE_INPUT_PER_1M = 0.50;
      const PRICE_CACHED_PER_1M = 0.03;
      const costWithoutCache = ((result.totalCachedTokens || 0) / 1_000_000) * PRICE_INPUT_PER_1M;
      const cacheSavings = costWithoutCache - (result.totalCachedInputCost || 0);
      const cacheSavingsPercentage = costWithoutCache > 0 
        ? (cacheSavings / costWithoutCache) * 100 
        : 0;

      // Calculate average cost per session
      const avgCostPerSession = (result.totalSessions || 0) > 0 
        ? (result.totalCost || 0) / (result.totalSessions || 0)
        : 0;

      res.json({
        totalSessions: result.totalSessions || 0,
        totalApiCalls: result.totalApiCalls || 0,
        totalCost: result.totalCost || 0,
        avgCostPerSession,
        
        // Cost breakdown
        costBreakdown: {
          textInput: result.totalTextInputCost || 0,
          audioInput: result.totalAudioInputCost || 0,
          audioOutput: result.totalAudioOutputCost || 0,
          cachedInput: result.totalCachedInputCost || 0,
        },
        
        // Token metrics
        tokens: {
          totalPrompt: result.totalPromptTokens || 0,
          totalCandidates: result.totalCandidatesTokens || 0,
          totalCached: result.totalCachedTokens || 0,
          cacheHitRate: Math.round(cacheHitRate * 10) / 10, // Round to 1 decimal
        },
        
        // Audio metrics
        audio: {
          totalInputSeconds: result.totalAudioInputSeconds || 0,
          totalOutputSeconds: result.totalAudioOutputSeconds || 0,
        },
        
        // Cache optimization savings
        cacheOptimization: {
          savingsUSD: cacheSavings,
          savingsPercentage: Math.round(cacheSavingsPercentage * 10) / 10, // ~94%
          costWithoutCache,
          costWithCache: result.totalCachedInputCost || 0,
        }
      });
    } catch (error: any) {
      console.error('❌ Error fetching Vertex AI usage analytics:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Library routes

  // Categories
  app.post("/api/library/categories", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertLibraryCategorySchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });

      const category = await storage.createLibraryCategory(validatedData);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/library/categories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Filter by consultant ID for consultants, show all for admins
      const consultantId = req.user?.role === "consultant" ? req.user.id : undefined;
      const categories = await storage.getLibraryCategories(consultantId);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/library/categories/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertLibraryCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updateLibraryCategory(req.params.id, updates);

      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.json(updatedCategory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/library/categories/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if category has subcategories
      const subcategories = await storage.getLibrarySubcategoriesByCategory(req.params.id);
      if (subcategories.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete category with existing subcategories. Delete subcategories first." 
        });
      }

      // Check if category has documents
      const documents = await storage.getLibraryDocumentsByCategory(req.params.id);
      if (documents.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete category with existing documents. Delete documents first." 
        });
      }

      const deleted = await storage.deleteLibraryCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Subcategories
  app.post("/api/library/subcategories", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertLibrarySubcategorySchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });

      const subcategory = await storage.createLibrarySubcategory(validatedData);
      res.status(201).json(subcategory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/library/subcategories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { categoryId } = req.query;
      // Filter by consultant ID for consultants
      const consultantId = req.user?.role === "consultant" ? req.user.id : undefined;

      let subcategories;
      if (categoryId) {
        subcategories = await storage.getLibrarySubcategoriesByCategory(categoryId as string);
      } else {
        subcategories = await storage.getLibrarySubcategories(consultantId);
      }

      res.json(subcategories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/library/subcategories/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertLibrarySubcategorySchema.partial().parse(req.body);
      const updatedSubcategory = await storage.updateLibrarySubcategory(req.params.id, updates);

      if (!updatedSubcategory) {
        return res.status(404).json({ message: "Subcategory not found" });
      }

      res.json(updatedSubcategory);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/library/subcategories/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Check if subcategory has documents
      const documents = await storage.getLibraryDocumentsBySubcategory(req.params.id);
      if (documents.length > 0) {
        return res.status(409).json({ 
          message: "Cannot delete subcategory with existing documents. Delete documents first." 
        });
      }

      const deleted = await storage.deleteLibrarySubcategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Subcategory not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Documents
  app.post("/api/library/documents", authenticateToken, requireRole("consultant"), upload.array('attachments'), async (req: AuthRequest, res) => {
    try {
      console.log('========== DOCUMENT CREATION DEBUG START ==========');
      console.log('STEP 1: Raw request body received');
      console.log('   - contentType:', req.body.contentType);
      console.log('   - videoUrl:', req.body.videoUrl);
      console.log('   - content length:', req.body.content?.length || 0);
      console.log('   - full body:', JSON.stringify(req.body, null, 2));

      console.log('\nSTEP 2: Processing contentType and videoUrl');
      const contentType = req.body.contentType || 'text';
      console.log('   - contentType value:', contentType);
      console.log('   - is "both"?', contentType === 'both');
      console.log('   - is "video"?', contentType === 'video');

      const categoryId = req.body.categoryId?.trim();
      const subcategoryId = req.body.subcategoryId && req.body.subcategoryId.trim() !== '' ? req.body.subcategoryId.trim() : null;
      const title = req.body.title?.trim();
      const subtitle = req.body.subtitle?.trim() || null;
      const description = req.body.description?.trim() || null;
      const content = req.body.content?.trim() || '';
      const level = req.body.level || 'base';

      let tags = [];
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          tags = JSON.parse(req.body.tags);
        } else {
          tags = req.body.tags;
        }
      }

      const estimatedDuration = req.body.estimatedDuration ? (parseInt(req.body.estimatedDuration, 10) || null) : null;
      const sortOrder = req.body.sortOrder ? parseInt(req.body.sortOrder, 10) : 0;
      const isPublished = req.body.isPublished !== undefined ? (req.body.isPublished === 'true' || req.body.isPublic === true) : true;
      const createdBy = req.user!.id;

      console.log('\nSTEP 3: Processing videoUrl based on contentType');
      let videoUrl = '';

      if (contentType === 'video' || contentType === 'both') {
        console.log('   - contentType requires video, processing videoUrl');
        console.log('   - raw videoUrl from request:', req.body.videoUrl);
        const rawVideoUrl = req.body.videoUrl?.trim();
        videoUrl = rawVideoUrl && rawVideoUrl !== '' ? rawVideoUrl : '';
        console.log('   - processed videoUrl:', videoUrl);
        console.log('   - videoUrl is empty?', videoUrl === '');
      } else {
        console.log('   - contentType is "text", videoUrl will be empty string');
        videoUrl = '';
      }

      // Clean and validate input data
      const documentData = {
        categoryId,
        subcategoryId,
        title,
        subtitle,
        description,
        content,
        contentType,
        videoUrl,
        level,
        tags,
        estimatedDuration,
        sortOrder,
        isPublished,
        createdBy,
      };

      console.log('\nSTEP 4: Final documentData object');
      console.log('   - contentType:', documentData.contentType);
      console.log('   - videoUrl:', documentData.videoUrl);
      console.log('   - content length:', documentData.content?.length || 0);
      console.log('   - full object:', JSON.stringify(documentData, null, 2));

      console.log('STEP 5: Validating data against schema...');

      // Validate with schema
      const validatedData = insertLibraryDocumentSchema.parse(documentData);

      console.log('STEP 6: Schema validation completed');
      console.log('   - validatedData:', JSON.stringify(validatedData, null, 2));

      // Handle file attachments - store both UUID filename and original name
      const attachments = req.files ? (req.files as any[]).map((file: any) => ({
        filename: file.filename, // UUID filename for server storage
        originalName: file.originalname, // Original filename for display
        size: file.size,
        mimetype: file.mimetype
      })) : [];

      console.log('STEP 7: Attachments processed:', attachments.length);

      console.log('STEP 8: About to call storage.createLibraryDocument...');
      const finalDataForStorage = {
        ...validatedData,
        attachments,
      };
      console.log('STEP 9: Final data being sent to storage:', JSON.stringify(finalDataForStorage, null, 2));

      const document = await storage.createLibraryDocument(finalDataForStorage);

      console.log('STEP 10: Document created in storage, result:', JSON.stringify(document, null, 2));
      console.log('========== DOCUMENT CREATION DEBUG END ==========');

      // Auto-sync to FileSearch for semantic RAG (async, don't block response)
      if (document.id && createdBy) {
        fileSearchSyncService.onDocumentUploaded(document.id, createdBy).catch(err => {
          console.error('❌ [FileSearch Auto-Sync] Failed to sync library document:', err);
        });
      }

      res.status(201).json(document);
    } catch (error: any) {
      console.error('DOCUMENT CREATION ERROR:', error);
      console.error('Error stack:', error.stack);

      // Handle Zod validation errors specifically
      if (error.name === 'ZodError') {
        console.error('ZOD VALIDATION ERRORS:', error.errors);
        const validationErrors = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({ 
          message: `Validation failed: ${validationErrors.join(', ')}`,
          errors: validationErrors 
        });
      }

      res.status(400).json({ message: error.message || "Failed to create document" });
    }
  });

  app.get("/api/library/documents", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { categoryId, level, tags, search, subcategoryId } = req.query;
      // Filter by consultant ID for consultants
      const consultantId = req.user?.role === "consultant" ? req.user.id : undefined;

      let documents;
      if (subcategoryId) {
        documents = await storage.getLibraryDocumentsBySubcategory(subcategoryId as string);
      } else if (categoryId) {
        documents = await storage.getLibraryDocumentsByCategory(categoryId as string);
      } else {
        documents = await storage.getLibraryDocuments(consultantId);
      }

      console.log('Retrieved documents from storage:', {
        count: documents.length,
        documents: documents.map(d => ({ id: d.id, title: d.title, isPublished: d.isPublished }))
      });

      // Apply filters
      if (tags) {
        const tagsArray = typeof tags === 'string' ? [tags] : tags as string[];
        documents = documents.filter(doc => 
          tagsArray.some(tag => doc.tags.includes(tag))
        );
      }

      if (search) {
        const searchTerm = (search as string).toLowerCase();
        documents = documents.filter(doc => 
          doc.title.toLowerCase().includes(searchTerm) ||
          doc.description?.toLowerCase().includes(searchTerm) ||
          doc.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      if (level && level !== 'all') {
        documents = documents.filter(doc => doc.level === level);
      }

      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/library/documents/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const document = await storage.getLibraryDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get document sections
      const sections = await storage.getLibraryDocumentSections(req.params.id);

      res.json({ ...document, sections });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/library/documents/:id', authenticateToken, requireRole("consultant"), upload.array('attachments'), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { 
        categoryId, 
        title, 
        subtitle, 
        description, 
        content, 
        level, 
        estimatedDuration, 
        tags, 
        sortOrder, 
        isPublished,
        existingAttachments 
      } = req.body;

      const currentDocument = await storage.getLibraryDocument(id);
      if (!currentDocument) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Process contentType and videoUrl
      console.log('\nSTEP 2: Processing contentType and videoUrl for update');
      const contentType = req.body.contentType || 'text';
      console.log('   - contentType value:', contentType);
      console.log('   - is "both"?', contentType === 'both');
      console.log('   - is "video"?', contentType === 'video');

      // Parse tags if it's a string
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (e) {
          parsedTags = [];
        }
      }

      // Parse existing attachments - make sure to preserve the object format
      let existingAttachmentsArray = [];
      if (existingAttachments !== undefined) { // Check if it's explicitly provided, even if empty
        try {
          const parsed = typeof existingAttachments === 'string' 
            ? JSON.parse(existingAttachments) 
            : existingAttachments;

          // Convert string attachments to object format if needed
          existingAttachmentsArray = parsed.map((att: any) => {
            if (typeof att === 'string') {
              // If it's a UUID string, try to create an object with a readable name
              if (att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
                const extension = att.split('.').pop();
                return {
                  filename: att,
                  originalName: `Documento.${extension}`,
                  size: 0,
                  mimetype: 'application/octet-stream'
                };
              } else {
                // Fallback for strings that don't match the UUID pattern
                return {
                  filename: att,
                  originalName: att, // Use the string itself as original name
                  size: 0,
                  mimetype: 'application/octet-stream'
                };
              }
            }
            // If it's already an object, keep it as is
            return att;
          });
        } catch (e) {
          console.error("Error parsing existingAttachments:", e);
          existingAttachmentsArray = []; // Reset if parsing fails
        }
      } else {
        // If existingAttachments is not provided, keep the current ones as base
        existingAttachmentsArray = currentDocument.attachments || [];
      }

      // Handle new file attachments
      let newAttachments = [];
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        newAttachments = req.files.map((file: any) => ({
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        }));
      }

      // Combine existing and new attachments
      const allAttachments = [...existingAttachmentsArray, ...newAttachments];

      console.log('\nSTEP 4: Building videoUrl for update');
      let videoUrlForUpdate = null;

      if (contentType === 'video' || contentType === 'both') {
        console.log('   - contentType requires video');
        console.log('   - raw videoUrl from request:', req.body.videoUrl);
        videoUrlForUpdate = req.body.videoUrl?.trim() || null;
        console.log('   - processed videoUrl for update:', videoUrlForUpdate);
        console.log('   - videoUrl is null?', videoUrlForUpdate === null);
      } else {
        console.log('   - contentType is "text", setting videoUrl to empty string to clear it');
        videoUrlForUpdate = '';
      }

      const updateData: any = {
        categoryId: categoryId !== undefined ? categoryId?.trim() : undefined,
        subcategoryId: req.body.subcategoryId?.trim() || null,
        title: title !== undefined ? title.trim() : undefined,
        subtitle: subtitle !== undefined ? (subtitle?.trim() || null) : undefined,
        description: description !== undefined ? (description?.trim() || null) : undefined,
        content: content !== undefined ? content.trim() : undefined,
        contentType: contentType,
        videoUrl: videoUrlForUpdate,
        level: level !== undefined ? level : undefined,
        estimatedDuration: estimatedDuration !== undefined ? (parseInt(estimatedDuration, 10) || null) : undefined,
        tags: tags !== undefined ? parsedTags : undefined,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder, 10) : undefined,
        isPublished: isPublished !== undefined ? (isPublished === 'true' || isPublished === true) : undefined,
        attachments: allAttachments,
        updatedAt: new Date(),
      };

      console.log('\nSTEP 5: Final update data');
      console.log('   - contentType:', updateData.contentType);
      console.log('   - videoUrl:', updateData.videoUrl);
      console.log('   - content length:', updateData.content?.length || 0);
      console.log('   - full update object:', JSON.stringify(updateData, null, 2));

      // Remove undefined fields to avoid overwriting with null if not intended
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const [updatedDocument] = await db
        .update(schema.libraryDocuments)
        .set(updateData)
        .where(eq(schema.libraryDocuments.id, id))
        .returning();

      if (!updatedDocument) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.json(updatedDocument);
    } catch (error: any) {
      console.error('Error updating library document:', error);
      // Handle Zod validation errors specifically
      if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
        return res.status(400).json({ 
          message: `Validation failed: ${validationErrors.join(', ')}`,
          errors: validationErrors 
        });
      }
      res.status(500).json({ error: 'Failed to update document', message: error.message });
    }
  });

  app.delete("/api/library/documents/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const document = await storage.getLibraryDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await db.delete(schema.libraryDocuments).where(eq(schema.libraryDocuments.id, req.params.id));
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Document sections
  app.post("/api/library/documents/:documentId/sections", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertLibraryDocumentSectionSchema.parse({
        ...req.body,
        documentId: req.params.documentId,
      });

      const section = await storage.createLibraryDocumentSection(validatedData);
      res.status(201).json(section);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/library/documents/:documentId/sections", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const sections = await storage.getLibraryDocumentSections(req.params.documentId);
      res.json(sections);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client progress tracking
  app.post("/api/library/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertClientLibraryProgressSchema.parse({
        ...req.body,
        clientId: req.user!.id,
      });

      const progress = await storage.markDocumentAsRead(validatedData);
      res.status(201).json(progress);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/library/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const progress = await storage.getClientLibraryProgress(req.user!.id);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Activity logging routes
  app.post("/api/activity/log", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { activityType, details, sessionId } = req.body;

      console.log('Activity log request:', { 
        userId: req.user?.id, 
        activityType, 
        sessionId,
        hasDetails: !!details 
      });

      if (!req.user?.id) {
        console.error('Activity log failed - no user ID');
        return res.status(400).json({ message: 'User ID is required' });
      }

      if (!activityType) {
        console.error('Activity log failed - no activity type');
        return res.status(400).json({ message: 'Activity type is required' });
      }

      const logData = {
        userId: req.user.id,
        activityType,
        details: details ? JSON.stringify(details) : null,
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };

      console.log('Creating activity log with data:', logData);
      const log = await storage.createUserActivityLog(logData);

      // Update session last activity
      if (sessionId) {
        console.log('Updating session last activity:', sessionId);
        await storage.updateUserSession(sessionId, { lastActivity: new Date() });
      }

      console.log('Activity logged successfully:', log.id);
      res.status(201).json({ 
        success: true,
        id: log.id,
        activityType: log.activityType,
        timestamp: log.timestamp
      });
    } catch (error: any) {
      console.error('Activity log error:', error);
      res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
  });

  app.post("/api/activity/session/start", authenticateToken, async (req: AuthRequest, res) => {
    try {
      console.log('Session start request - user:', req.user?.id);

      if (!req.user?.id) {
        console.error('Session start failed - no user ID');
        return res.status(400).json({ message: 'User ID is required' });
      }

      const sessionId = randomUUID();

      const sessionData = {
        userId: req.user.id,
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      };

      console.log('Creating session with data:', sessionData);
      const session = await storage.createUserSession(sessionData);

      // Log login activity
      console.log('Logging login activity for session:', sessionId);
      await storage.createUserActivityLog({
        userId: req.user.id,
        activityType: 'login',
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      console.log('Session created successfully:', sessionId);
      res.status(201).json({ sessionId: session.sessionId });
    } catch (error: any) {
      console.error('Session start error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/activity/session/end", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.body;

      if (sessionId) {
        await storage.endUserSession(sessionId);

        // Log logout activity
        await storage.createUserActivityLog({
          userId: req.user!.id,
          activityType: 'logout',
          sessionId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      }

      res.status(200).json({ message: 'Session ended' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/activity/session/heartbeat", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: 'Session ID is required' });
      }

      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      await storage.updateUserSession(sessionId, { 
        lastActivity: new Date() 
      });

      res.status(200).json({ success: true, lastActivity: new Date() });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Activity monitoring routes for consultants
  app.get("/api/activity/clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      console.log('Getting activity logs for consultant:', req.user!.id);
      const logs = await storage.getUserActivityLogsByConsultant(req.user!.id, start, end);
      console.log('Found activity logs:', logs.length);

      // Get user details for each log
      const logsWithUsers = await Promise.all(logs.map(async (log) => {
        const user = await storage.getUser(log.userId);
        return {
          ...log,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
          } : null,
        };
      }));

      console.log('Returning logs with users:', logsWithUsers.length);
      res.json(logsWithUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/activity/sessions/active", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      console.log('Getting active sessions for consultant:', req.user!.id);
      const sessions = await storage.getActiveUserSessions(req.user!.id);
      console.log('Found active sessions:', sessions.length);

      // Get user details for each session
      const sessionsWithUsers = await Promise.all(sessions.map(async (session) => {
        const user = await storage.getUser(session.userId);
        return {
          ...session,
          user: user ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
          } : null,
        };
      }));

      console.log('Returning sessions with users:', sessionsWithUsers.length);
      res.json(sessionsWithUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/analytics/exercise-performance", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const metricsData = {
        ...req.body,
        startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
        completedAt: req.body.completedAt ? new Date(req.body.completedAt) : undefined,
      };

      const metrics = await storage.createExercisePerformanceMetrics(metricsData);
      res.status(201).json(metrics);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Submit content request
  app.post("/api/library/content-requests", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { title, description, category, priority, suggestedLevel, requestedAt } = req.body;
      const userId = req.user!.id; // Use req.user!.id directly as authenticateToken ensures it's available

      const requestData = {
        id: crypto.randomUUID(),
        userId,
        title: title.trim(),
        description: description.trim(),
        categoryId: category || null,
        priority: priority || 'medium',
        suggestedLevel: suggestedLevel || 'base',
        status: 'pending',
        requestedAt: requestedAt || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Store the request (you can implement proper database storage later)
      console.log('Content request submitted:', requestData);

      // In a real application, you would save requestData to your database here.
      // For now, we'll just log it.
      // await storage.createContentRequest(requestData); 

      res.status(201).json({ success: true, id: requestData.id });
    } catch (error: any) {
      console.error('Error submitting content request:', error);
      res.status(500).json({ error: 'Failed to submit content request', message: error.message });
    }
  });

  // Mark document as read
  app.post("/api/library/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertClientLibraryProgressSchema.parse({
        ...req.body,
        clientId: req.user!.id,
      });

      const progress = await storage.markDocumentAsRead(validatedData);
      res.status(201).json(progress);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Category-Client Assignment Routes
  app.post("/api/library/categories/:id/assign-clients", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientIds } = req.body;

      // Verify category exists
      const category = await storage.getLibraryCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      await storage.assignCategoryToClients(req.params.id, clientIds || [], req.user!.id);
      
      // PRIVACY ISOLATION: Sync library docs to each client's private store
      if (clientIds && clientIds.length > 0) {
        for (const clientId of clientIds) {
          fileSearchSyncService.syncLibraryCategoryToClient(req.params.id, clientId, req.user!.id).catch(err => {
            console.error(`[FileSync] Failed to sync library category to client ${clientId}:`, err.message);
          });
        }
      }
      
      res.json({ message: "Category assignments updated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/library/categories/:id/assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Verify category exists
      const category = await storage.getLibraryCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const assignments = await storage.getCategoryClientAssignments(req.params.id, req.user!.id);

      // Get client details
      const assignmentsWithClients = await Promise.all(
        assignments.map(async (assignment) => {
          const client = await storage.getUser(assignment.clientId);
          return {
            ...assignment,
            client: client ? {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              avatar: client.avatar,
            } : null,
          };
        })
      );

      res.json(assignmentsWithClients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/library/categories/:categoryId/clients/:clientId/visibility", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { isVisible } = req.body;

      // Verify category exists
      const category = await storage.getLibraryCategory(req.params.categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      await storage.updateCategoryClientVisibility(
        req.params.categoryId, 
        req.params.clientId, 
        req.user!.id, 
        isVisible
      );

      res.json({ message: "Visibility updated successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get categories visible to a client (for client-side access)
  app.get("/api/library/categories/client/visible", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const categories = await storage.getVisibleCategoriesForClient(req.user!.id);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== YOUTUBE AI COURSE BUILDER ROUTES =====

  // Fetch video info and transcript
  app.post("/api/youtube/video", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { url, transcriptMode = 'auto' } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const { extractVideoId, fetchVideoMetadata, fetchTranscript, saveVideoWithTranscript } = await import("./services/youtube-service");
      
      const videoId = extractVideoId(url);
      if (!videoId) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      const result = await saveVideoWithTranscript(req.user!.id, url, undefined, undefined, transcriptMode);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      // Aggiungi flag reused al video per notificare il frontend
      res.json({ ...result.video, reused: result.reused || false });
    } catch (error: any) {
      console.error('Error fetching video:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Fetch playlist videos
  app.post("/api/youtube/playlist", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ message: "URL is required" });
      }

      const { extractPlaylistId, fetchPlaylistVideos, isPlaylistUrl } = await import("./services/youtube-service");
      
      if (!isPlaylistUrl(url)) {
        return res.status(400).json({ message: "Not a valid playlist URL" });
      }

      const playlistId = extractPlaylistId(url);
      if (!playlistId) {
        return res.status(400).json({ message: "Could not extract playlist ID" });
      }

      const videos = await fetchPlaylistVideos(playlistId);
      
      if (videos.length === 0) {
        return res.status(404).json({ message: "No videos found in playlist or playlist is private" });
      }

      res.json({ playlistId, videos });
    } catch (error: any) {
      console.error('Error fetching playlist:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Save selected videos from playlist
  app.post("/api/youtube/playlist/save", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { videos, playlistId, playlistTitle, transcriptMode = 'auto' } = req.body;
      if (!videos || !Array.isArray(videos)) {
        return res.status(400).json({ message: "Videos array is required" });
      }

      const { saveVideoWithTranscript } = await import("./services/youtube-service");
      
      const savedVideos = [];
      const errors = [];
      let reusedCount = 0;

      for (const video of videos) {
        const result = await saveVideoWithTranscript(
          req.user!.id, 
          video.videoUrl, 
          playlistId, 
          playlistTitle,
          transcriptMode
        );
        
        if (result.success) {
          savedVideos.push({ ...result.video, reused: result.reused || false });
          if (result.reused) reusedCount++;
        } else {
          errors.push({ videoId: video.videoId, error: result.error });
        }
      }

      res.json({ savedVideos, errors, reusedCount });
    } catch (error: any) {
      console.error('Error saving playlist videos:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // SSE endpoint for saving playlist videos with real-time updates
  app.post("/api/youtube/playlist/save-stream", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) (res as any).flush();
    };

    try {
      const { videos, playlistId, playlistTitle, transcriptMode = 'auto' } = req.body;
      if (!videos || !Array.isArray(videos)) {
        send({ type: 'error', error: 'Videos array is required' });
        return res.end();
      }

      const { saveVideoWithTranscriptStream } = await import("./services/youtube-service");
      
      const savedVideos = [];
      const errors = [];
      const total = videos.length;

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        send({ type: 'progress', current: i + 1, total });
        send({ type: 'start', videoId: video.videoId, title: video.title });
        
        try {
          const result = await saveVideoWithTranscriptStream(
            req.user!.id, 
            video.videoUrl, 
            playlistId, 
            playlistTitle,
            transcriptMode,
            (status: string, message?: string) => {
              send({ type: status, videoId: video.videoId, title: video.title, message });
            },
            // Metadati dalla playlist per fallback se oEmbed fallisce (video non embeddabili)
            { title: video.title, thumbnailUrl: video.thumbnail, channelName: video.channelTitle }
          );
          
          if (result.success) {
            // Escludi transcript dal saved video per evitare JSON troppo grande
            const { transcript, description, ...videoWithoutLargeFields } = result.video || {};
            savedVideos.push({ 
              ...videoWithoutLargeFields, 
              reused: result.reused || false,
              transcriptStatus: result.video?.transcriptStatus,
              transcriptLength: transcript?.length || 0 
            });
            if (result.reused) {
              send({ type: 'reused', videoId: video.videoId, title: video.title });
            } else {
              send({ type: 'completed', videoId: video.videoId, title: video.title, transcriptLength: transcript?.length || 0 });
            }
          } else {
            errors.push({ videoId: video.videoId, error: result.error });
            send({ type: 'error', videoId: video.videoId, title: video.title, error: result.error });
          }
        } catch (err: any) {
          errors.push({ videoId: video.videoId, error: err.message });
          send({ type: 'error', videoId: video.videoId, title: video.title, error: err.message });
        }
      }

      send({ type: 'done', savedVideos, errors });
      res.end();
    } catch (error: any) {
      console.error('Error in save-stream:', error);
      send({ type: 'error', error: error.message });
      res.end();
    }
  });

  // Get saved YouTube videos for consultant
  app.get("/api/youtube/videos", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const videos = await db.select()
        .from(schema.youtubeVideos)
        .where(eq(schema.youtubeVideos.consultantId, req.user!.id))
        .orderBy(desc(schema.youtubeVideos.createdAt));
      
      res.json(videos);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI suggest module names based on video titles
  app.post("/api/library/ai-suggest-modules", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { videoTitles, moduleCount, courseName } = req.body;
      
      if (!videoTitles || !Array.isArray(videoTitles) || videoTitles.length === 0) {
        return res.status(400).json({ message: "videoTitles array is required" });
      }
      
      const count = Math.min(Math.max(moduleCount || 1, 1), 10);
      
      const { getAIProvider } = await import("./ai/provider-factory");
      const providerResult = await getAIProvider(req.user!.id);
      
      if (!providerResult.client) {
        // Fallback: genera nomi generici
        const names = Array.from({ length: count }, (_, i) => `Modulo ${i + 1}`);
        return res.json({ names, aiGenerated: false });
      }
      
      const prompt = `Sei un esperto nella creazione di corsi formativi.
      
${courseName ? `NOME DEL CORSO: ${courseName}\n` : ''}
TITOLI DEI VIDEO LEZIONE:
${videoTitles.map((t: string, i: number) => `${i + 1}. ${t}`).join('\n')}

Devo organizzare questi ${videoTitles.length} video in ${count} moduli.
Analizza i titoli e suggerisci ${count} nomi di moduli che:
1. Raggruppino logicamente i video per argomento
2. Siano brevi e descrittivi (massimo 5 parole)
3. Seguano una progressione logica (dal base all'avanzato, o cronologica)

Rispondi SOLO con un JSON array di stringhe, senza altri testi:
["Nome Modulo 1", "Nome Modulo 2", ...]`;

      const response = await providerResult.client.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      
      const text = response.response.text() || '';
      
      try {
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const names = JSON.parse(cleanJson);
        if (Array.isArray(names) && names.length > 0) {
          res.json({ names: names.slice(0, count), aiGenerated: true });
        } else {
          throw new Error('Invalid response format');
        }
      } catch {
        // Fallback se parsing fallisce
        const names = Array.from({ length: count }, (_, i) => `Modulo ${i + 1}`);
        res.json({ names, aiGenerated: false });
      }
    } catch (error: any) {
      console.error('Error suggesting module names:', error);
      const count = req.body.moduleCount || 1;
      const names = Array.from({ length: count }, (_, i) => `Modulo ${i + 1}`);
      res.json({ names, aiGenerated: false });
    }
  });

  // Generate lesson from video
  app.post("/api/library/ai-generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { youtubeVideoId, categoryId, subcategoryId, customInstructions, level, contentType } = req.body;
      
      if (!youtubeVideoId || !categoryId) {
        return res.status(400).json({ message: "youtubeVideoId and categoryId are required" });
      }

      const { generateLessonFromVideo } = await import("./services/ai-lesson-generator");
      
      const result = await generateLessonFromVideo({
        consultantId: req.user!.id,
        youtubeVideoId,
        categoryId,
        subcategoryId,
        customInstructions,
        level,
        contentType,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json(result.lesson);
    } catch (error: any) {
      console.error('Error generating lesson:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate multiple lessons
  app.post("/api/library/ai-generate-batch", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { videoIds, categoryId, subcategoryId, customInstructions, level, contentType } = req.body;
      
      if (!videoIds || !Array.isArray(videoIds) || !categoryId) {
        return res.status(400).json({ message: "videoIds array and categoryId are required" });
      }

      const { generateMultipleLessons } = await import("./services/ai-lesson-generator");
      
      const result = await generateMultipleLessons(
        req.user!.id,
        videoIds,
        categoryId,
        subcategoryId,
        customInstructions,
        level,
        contentType
      );

      res.json(result);
    } catch (error: any) {
      console.error('Error generating lessons:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Regenerate a single lesson (uses existing transcript)
  app.post("/api/library/ai-regenerate/:lessonId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { lessonId } = req.params;
      const { customInstructions, level, contentType } = req.body;

      const [existingLesson] = await db.select()
        .from(schema.libraryDocuments)
        .where(and(
          eq(schema.libraryDocuments.id, lessonId),
          eq(schema.libraryDocuments.createdBy, req.user!.id)
        ));

      if (!existingLesson) {
        return res.status(404).json({ message: "Lezione non trovata" });
      }

      if (!existingLesson.youtubeVideoId) {
        return res.status(400).json({ message: "Questa lezione non ha un video sorgente associato" });
      }

      const { generateLessonFromVideo } = await import("./services/ai-lesson-generator");
      
      const result = await generateLessonFromVideo({
        consultantId: req.user!.id,
        youtubeVideoId: existingLesson.youtubeVideoId,
        categoryId: existingLesson.categoryId,
        subcategoryId: existingLesson.subcategoryId || undefined,
        customInstructions,
        level: level || existingLesson.level,
        contentType: contentType || existingLesson.contentType,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      await db.delete(schema.libraryDocuments)
        .where(eq(schema.libraryDocuments.id, lessonId));

      res.json({ 
        message: "Lezione rigenerata con successo", 
        oldLessonId: lessonId,
        newLesson: result.lesson 
      });
    } catch (error: any) {
      console.error('Error regenerating lesson:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI lesson settings
  app.get("/api/library/ai-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { getAiLessonSettings } = await import("./services/youtube-service");
      const settings = await getAiLessonSettings(req.user!.id);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Save AI lesson settings
  app.put("/api/library/ai-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { saveAiLessonSettings } = await import("./services/youtube-service");
      await saveAiLessonSettings(req.user!.id, req.body);
      res.json({ message: "Settings saved" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SSE endpoint for real-time AI lesson generation progress
  app.post("/api/library/ai-generate-batch-stream", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { videoIds, categoryId, subcategoryId, customInstructions, level, contentType } = req.body;
      
      if (!videoIds || !Array.isArray(videoIds) || !categoryId) {
        return res.status(400).json({ message: "videoIds array and categoryId are required" });
      }

      // SSE headers - critical for real-time streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx/proxy buffering
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Disable Nagle algorithm for immediate sending
      if (res.socket) {
        res.socket.setNoDelay(true);
        res.socket.setTimeout(0);
      }
      
      res.flushHeaders();
      
      // Force initial chunk through proxy buffering with padding comment
      // Some proxies buffer until they receive ~1KB of data
      const padding = `:${' '.repeat(2048)}\n\n`;
      res.write(padding);
      
      // Send initial heartbeat to confirm connection
      const connectedEvent = `data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`;
      res.write(connectedEvent);
      console.log('[SSE] Sent connected event + padding');

      const { generateMultipleLessons } = await import("./services/ai-lesson-generator");
      
      const onProgress = (current: number, total: number, status: string, videoId?: string, videoTitle?: string, errorMessage?: string, logMessage?: string) => {
        console.log(`[SSE] onProgress: ${status} ${current}/${total} - ${videoId} "${videoTitle || ''}" - ${logMessage || ''}`);
        
        let eventData: any;
        if (status === 'generating') {
          eventData = { type: 'progress', current, total, videoId, videoTitle, status, log: logMessage };
        } else if (status === 'completed') {
          eventData = { type: 'video_complete', current, total, videoId, videoTitle, log: logMessage };
        } else if (status === 'error') {
          eventData = { type: 'video_error', current, total, videoId, videoTitle, error: errorMessage, log: logMessage };
        }
        
        if (eventData) {
          const chunk = `data: ${JSON.stringify(eventData)}\n\n`;
          res.write(chunk);
          console.log(`[SSE] Sent ${chunk.length} bytes: ${eventData.type}`);
        }
      };

      const result = await generateMultipleLessons(
        req.user!.id,
        videoIds,
        categoryId,
        subcategoryId,
        customInstructions,
        level,
        contentType,
        onProgress
      );

      res.write(`data: ${JSON.stringify({ type: 'complete', lessons: result.lessons, errors: result.errors })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error('Error in SSE lesson generation:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  });

  // Publish AI-generated lessons (confirm and make visible in course)
  app.post("/api/library/ai-publish-lessons", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { lessonIds, moduleAssignments } = req.body;
      
      if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
        return res.status(400).json({ message: "lessonIds array is required" });
      }

      // Update all lessons to published (and assign to modules if provided)
      const updatedLessons = [];
      for (const lessonId of lessonIds) {
        const updateData: any = { isPublished: true };
        
        // If moduleAssignments provided, update subcategoryId
        if (moduleAssignments && moduleAssignments[lessonId]) {
          updateData.subcategoryId = moduleAssignments[lessonId];
        }
        
        const [lesson] = await db.update(schema.libraryDocuments)
          .set(updateData)
          .where(and(
            eq(schema.libraryDocuments.id, lessonId),
            eq(schema.libraryDocuments.createdBy, req.user!.id)
          ))
          .returning();
        
        if (lesson) {
          updatedLessons.push(lesson);
        }
      }

      console.log(`✅ [AI-BUILDER] Published ${updatedLessons.length} lessons for consultant ${req.user!.id}${moduleAssignments ? ' with module assignments' : ''}`);
      res.json({ success: true, published: updatedLessons.length });
    } catch (error: any) {
      console.error('Error publishing lessons:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Check if videos are already used in existing lessons (duplicate detection)
  app.post("/api/library/check-video-duplicates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { videoIds } = req.body;
      
      if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return res.json({ duplicates: [] });
      }

      // Find existing lessons that use these YouTube video IDs
      const existingLessons = await db
        .select({
          lessonId: schema.libraryDocuments.id,
          lessonTitle: schema.libraryDocuments.title,
          youtubeVideoId: schema.libraryDocuments.youtubeVideoId,
          categoryId: schema.libraryDocuments.categoryId,
          subcategoryId: schema.libraryDocuments.subcategoryId,
          isPublished: schema.libraryDocuments.isPublished,
        })
        .from(schema.libraryDocuments)
        .where(and(
          eq(schema.libraryDocuments.createdBy, req.user!.id),
          inArray(schema.libraryDocuments.youtubeVideoId, videoIds)
        ));

      if (existingLessons.length === 0) {
        return res.json({ duplicates: [] });
      }

      // Get category and subcategory names for the duplicates
      const categoryIds = [...new Set(existingLessons.map(l => l.categoryId).filter(Boolean))];
      const subcategoryIds = [...new Set(existingLessons.map(l => l.subcategoryId).filter(Boolean))];

      const categories = categoryIds.length > 0 
        ? await db.select({ id: schema.libraryCategories.id, name: schema.libraryCategories.name })
            .from(schema.libraryCategories)
            .where(inArray(schema.libraryCategories.id, categoryIds as string[]))
        : [];

      const subcategories = subcategoryIds.length > 0
        ? await db.select({ id: schema.librarySubcategories.id, name: schema.librarySubcategories.name })
            .from(schema.librarySubcategories)
            .where(inArray(schema.librarySubcategories.id, subcategoryIds as string[]))
        : [];

      const categoryMap = new Map(categories.map(c => [c.id, c.name]));
      const subcategoryMap = new Map(subcategories.map(s => [s.id, s.name]));

      // Build duplicates response with full path
      const duplicates = existingLessons.map(lesson => ({
        lessonId: lesson.lessonId,
        youtubeVideoId: lesson.youtubeVideoId,
        lessonTitle: lesson.lessonTitle,
        courseName: categoryMap.get(lesson.categoryId!) || 'Corso sconosciuto',
        moduleName: lesson.subcategoryId ? subcategoryMap.get(lesson.subcategoryId) || null : null,
        isPublished: lesson.isPublished,
        path: lesson.subcategoryId && subcategoryMap.get(lesson.subcategoryId)
          ? `${categoryMap.get(lesson.categoryId!) || 'Corso'} > ${subcategoryMap.get(lesson.subcategoryId)} > ${lesson.lessonTitle}`
          : `${categoryMap.get(lesson.categoryId!) || 'Corso'} > ${lesson.lessonTitle}`,
      }));

      console.log(`🔍 [DUPLICATE-CHECK] Found ${duplicates.length} duplicates for consultant ${req.user!.id}`);
      res.json({ duplicates });
    } catch (error: any) {
      console.error('Error checking video duplicates:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unpublished AI-generated lessons (drafts) for current consultant
  app.get("/api/library/ai-unpublished-lessons", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const unpublishedLessons = await db.select()
        .from(schema.libraryDocuments)
        .where(and(
          eq(schema.libraryDocuments.createdBy, req.user!.id),
          eq(schema.libraryDocuments.isPublished, false),
          eq(schema.libraryDocuments.aiGenerated, true)
        ))
        .orderBy(desc(schema.libraryDocuments.createdAt));
      
      console.log(`📋 [AI-BUILDER] Found ${unpublishedLessons.length} unpublished AI lessons for consultant ${req.user!.id}`);
      res.json(unpublishedLessons);
    } catch (error: any) {
      console.error('Error fetching unpublished lessons:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== AI BUILDER DRAFTS CRUD ROUTES =====

  // List all drafts for consultant
  app.get("/api/library/ai-builder-drafts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const drafts = await db.select()
        .from(schema.aiBuilderDrafts)
        .where(eq(schema.aiBuilderDrafts.consultantId, req.user!.id))
        .orderBy(desc(schema.aiBuilderDrafts.updatedAt));
      
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new draft
  app.post("/api/library/ai-builder-drafts", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { 
        name, 
        youtubeUrl, 
        inputType, 
        selectedCategoryId, 
        selectedSubcategoryId, 
        selectedVideoIds, 
        playlistVideos, 
        savedVideoIds, 
        aiInstructions, 
        contentType, 
        level, 
        currentStep 
      } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Draft name is required" });
      }

      const [draft] = await db.insert(schema.aiBuilderDrafts).values({
        consultantId: req.user!.id,
        name,
        youtubeUrl,
        inputType,
        selectedCategoryId,
        selectedSubcategoryId,
        selectedVideoIds: selectedVideoIds || [],
        playlistVideos: playlistVideos || [],
        savedVideoIds: savedVideoIds || [],
        aiInstructions,
        contentType,
        level,
        currentStep,
      }).returning();

      res.status(201).json(draft);
    } catch (error: any) {
      console.error('Error creating draft:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update existing draft
  app.put("/api/library/ai-builder-drafts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const draftId = req.params.id;
      
      const [existingDraft] = await db.select()
        .from(schema.aiBuilderDrafts)
        .where(and(
          eq(schema.aiBuilderDrafts.id, draftId),
          eq(schema.aiBuilderDrafts.consultantId, req.user!.id)
        ));

      if (!existingDraft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      const { 
        name, 
        youtubeUrl, 
        inputType, 
        selectedCategoryId, 
        selectedSubcategoryId, 
        selectedVideoIds, 
        playlistVideos, 
        savedVideoIds, 
        aiInstructions, 
        contentType, 
        level, 
        currentStep 
      } = req.body;

      const [updatedDraft] = await db.update(schema.aiBuilderDrafts)
        .set({
          name,
          youtubeUrl,
          inputType,
          selectedCategoryId,
          selectedSubcategoryId,
          selectedVideoIds: selectedVideoIds || existingDraft.selectedVideoIds,
          playlistVideos: playlistVideos || existingDraft.playlistVideos,
          savedVideoIds: savedVideoIds || existingDraft.savedVideoIds,
          aiInstructions,
          contentType,
          level,
          currentStep,
          updatedAt: new Date(),
        })
        .where(eq(schema.aiBuilderDrafts.id, draftId))
        .returning();

      res.json(updatedDraft);
    } catch (error: any) {
      console.error('Error updating draft:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete draft
  app.delete("/api/library/ai-builder-drafts/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const draftId = req.params.id;
      
      const [existingDraft] = await db.select()
        .from(schema.aiBuilderDrafts)
        .where(and(
          eq(schema.aiBuilderDrafts.id, draftId),
          eq(schema.aiBuilderDrafts.consultantId, req.user!.id)
        ));

      if (!existingDraft) {
        return res.status(404).json({ message: "Draft not found" });
      }

      await db.delete(schema.aiBuilderDrafts)
        .where(eq(schema.aiBuilderDrafts.id, draftId));

      res.json({ message: "Draft deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== TRANSCRIPT PREVIEW ENDPOINT =====

  // Get video transcript for preview
  app.get("/api/youtube/video/:id/transcript", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const videoId = req.params.id;
      
      const [video] = await db.select()
        .from(schema.youtubeVideos)
        .where(and(
          eq(schema.youtubeVideos.id, videoId),
          eq(schema.youtubeVideos.consultantId, req.user!.id)
        ));

      if (!video) {
        return res.status(404).json({ message: "Video not found or not owned by consultant" });
      }

      res.json({
        transcript: video.transcript,
        transcriptStatus: video.transcriptStatus,
        title: video.title,
        videoId: video.videoId,
      });
    } catch (error: any) {
      console.error('Error fetching transcript:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update video transcript manually (fallback when auto-extraction fails)
  app.put("/api/youtube/video/:id/transcript", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const videoId = req.params.id;
      const { transcript } = req.body;
      
      if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
        return res.status(400).json({ message: "La trascrizione deve contenere almeno 10 caratteri" });
      }
      
      const [video] = await db.select()
        .from(schema.youtubeVideos)
        .where(and(
          eq(schema.youtubeVideos.id, videoId),
          eq(schema.youtubeVideos.consultantId, req.user!.id)
        ));

      if (!video) {
        return res.status(404).json({ message: "Video not found or not owned by consultant" });
      }

      const [updated] = await db.update(schema.youtubeVideos)
        .set({ 
          transcript: transcript.trim(),
          transcriptStatus: 'completed'
        })
        .where(eq(schema.youtubeVideos.id, videoId))
        .returning();

      res.json({
        message: "Trascrizione salvata con successo",
        transcript: updated.transcript,
        transcriptStatus: updated.transcriptStatus,
      });
    } catch (error: any) {
      console.error('Error saving transcript:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ===== UNIVERSITY MODULE ROUTES =====

  // Templates
  app.post("/api/university/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityTemplateSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });
      const template = await db.insert(schema.universityTemplates).values(validatedData).returning();
      res.status(201).json(template[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const templates = await db.select().from(schema.universityTemplates).where(eq(schema.universityTemplates.createdBy, req.user!.id));
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const template = await db.select().from(schema.universityTemplates).where(eq(schema.universityTemplates.id, req.params.id));
      if (!template[0]) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template[0]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityTemplateSchema.partial().parse(req.body);
      const template = await db.update(schema.universityTemplates)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.universityTemplates.id, req.params.id))
        .returning();
      if (!template[0]) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await db.delete(schema.universityTemplates).where(eq(schema.universityTemplates.id, req.params.id)).returning();
      if (!deleted[0]) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Template Trimesters
  app.post("/api/university/templates/:templateId/trimesters", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertTemplateTrimesterSchema.parse({
        ...req.body,
        templateId: req.params.templateId,
      });
      const trimester = await db.insert(schema.templateTrimesters)
        .values(validatedData)
        .returning();
      res.status(201).json(trimester[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/templates/:templateId/trimesters", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const trimesters = await db.select()
        .from(schema.templateTrimesters)
        .where(eq(schema.templateTrimesters.templateId, req.params.templateId))
        .orderBy(schema.templateTrimesters.sortOrder);
      res.json(trimesters);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/templates/trimesters/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertTemplateTrimesterSchema.partial().parse(req.body);
      const trimester = await db.update(schema.templateTrimesters)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.templateTrimesters.id, req.params.id))
        .returning();
      if (!trimester[0]) {
        return res.status(404).json({ message: "Template trimester not found" });
      }
      res.json(trimester[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/templates/trimesters/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await db.delete(schema.templateTrimesters)
        .where(eq(schema.templateTrimesters.id, req.params.id))
        .returning();
      if (!deleted[0]) {
        return res.status(404).json({ message: "Template trimester not found" });
      }
      res.json({ message: "Template trimester deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Template Modules
  app.post("/api/university/templates/trimesters/:trimesterId/modules", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertTemplateModuleSchema.parse({
        ...req.body,
        templateTrimesterId: req.params.trimesterId,
      });
      const module = await db.insert(schema.templateModules)
        .values(validatedData)
        .returning();
      res.status(201).json(module[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/templates/trimesters/:trimesterId/modules", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const modules = await db.select()
        .from(schema.templateModules)
        .where(eq(schema.templateModules.templateTrimesterId, req.params.trimesterId))
        .orderBy(schema.templateModules.sortOrder);
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/templates/modules/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertTemplateModuleSchema.partial().parse(req.body);
      const module = await db.update(schema.templateModules)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.templateModules.id, req.params.id))
        .returning();
      if (!module[0]) {
        return res.status(404).json({ message: "Template module not found" });
      }
      res.json(module[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/templates/modules/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await db.delete(schema.templateModules)
        .where(eq(schema.templateModules.id, req.params.id))
        .returning();
      if (!deleted[0]) {
        return res.status(404).json({ message: "Template module not found" });
      }
      res.json({ message: "Template module deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Template Lessons
  app.post("/api/university/templates/modules/:moduleId/lessons", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertTemplateLessonSchema.parse({
        ...req.body,
        templateModuleId: req.params.moduleId,
      });
      const lesson = await db.insert(schema.templateLessons)
        .values(validatedData)
        .returning();
      res.status(201).json(lesson[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/templates/modules/:moduleId/lessons", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const lessons = await db.select()
        .from(schema.templateLessons)
        .where(eq(schema.templateLessons.templateModuleId, req.params.moduleId))
        .orderBy(schema.templateLessons.sortOrder);
      res.json(lessons);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/templates/lessons/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertTemplateLessonSchema.partial().parse(req.body);
      const lesson = await db.update(schema.templateLessons)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.templateLessons.id, req.params.id))
        .returning();
      if (!lesson[0]) {
        return res.status(404).json({ message: "Template lesson not found" });
      }
      res.json(lesson[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/templates/lessons/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await db.delete(schema.templateLessons)
        .where(eq(schema.templateLessons.id, req.params.id))
        .returning();
      if (!deleted[0]) {
        return res.status(404).json({ message: "Template lesson not found" });
      }
      res.json({ message: "Template lesson deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Full Template Structure
  app.get("/api/university/templates/:id/full", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const template = await db.select()
        .from(schema.universityTemplates)
        .where(eq(schema.universityTemplates.id, req.params.id));

      if (!template[0]) {
        return res.status(404).json({ message: "Template not found" });
      }

      const trimesters = await db.select()
        .from(schema.templateTrimesters)
        .where(eq(schema.templateTrimesters.templateId, req.params.id))
        .orderBy(schema.templateTrimesters.sortOrder);

      const trimesterIds = trimesters.map(t => t.id);
      let modules: any[] = [];
      if (trimesterIds.length > 0) {
        modules = await db.select()
          .from(schema.templateModules)
          .where(inArray(schema.templateModules.templateTrimesterId, trimesterIds))
          .orderBy(schema.templateModules.sortOrder);
      }

      const moduleIds = modules.map(m => m.id);
      let lessons: any[] = [];
      if (moduleIds.length > 0) {
        lessons = await db.select()
          .from(schema.templateLessons)
          .where(inArray(schema.templateLessons.templateModuleId, moduleIds))
          .orderBy(schema.templateLessons.sortOrder);
      }

      const trimestersWithModules = trimesters.map(trimester => ({
        ...trimester,
        modules: modules
          .filter(m => m.templateTrimesterId === trimester.id)
          .map(module => ({
            ...module,
            lessons: lessons.filter(l => l.templateModuleId === module.id)
          }))
      }));

      res.json({
        ...template[0],
        trimesters: trimestersWithModules
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Duplicate template with full structure
  app.post("/api/university/templates/:id/duplicate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const originalTemplateId = req.params.id;

      // Get original template
      const [originalTemplate] = await db.select()
        .from(schema.universityTemplates)
        .where(eq(schema.universityTemplates.id, originalTemplateId));

      if (!originalTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }

      // Create new template with "Copia di" prefix
      const [newTemplate] = await db.insert(schema.universityTemplates).values({
        name: `Copia di ${originalTemplate.name}`,
        description: originalTemplate.description,
        isActive: false, // New copies are inactive by default
        createdBy: req.user!.id,
      }).returning();

      // Get all trimesters from original template
      const originalTrimesters = await db.select()
        .from(schema.templateTrimesters)
        .where(eq(schema.templateTrimesters.templateId, originalTemplateId))
        .orderBy(schema.templateTrimesters.sortOrder);

      // Duplicate trimesters and maintain mapping for modules
      const trimesterMapping: Record<string, string> = {};
      for (const trimester of originalTrimesters) {
        const [newTrimester] = await db.insert(schema.templateTrimesters).values({
          templateId: newTemplate.id,
          title: trimester.title,
          description: trimester.description,
          sortOrder: trimester.sortOrder,
        }).returning();
        trimesterMapping[trimester.id] = newTrimester.id;
      }

      // Get all modules from original trimesters
      if (originalTrimesters.length > 0) {
        const originalTrimesterIds = originalTrimesters.map(t => t.id);
        const originalModules = await db.select()
          .from(schema.templateModules)
          .where(inArray(schema.templateModules.templateTrimesterId, originalTrimesterIds))
          .orderBy(schema.templateModules.sortOrder);

        // Duplicate modules and maintain mapping for lessons
        const moduleMapping: Record<string, string> = {};
        for (const module of originalModules) {
          const [newModule] = await db.insert(schema.templateModules).values({
            templateTrimesterId: trimesterMapping[module.templateTrimesterId],
            title: module.title,
            description: module.description,
            sortOrder: module.sortOrder,
          }).returning();
          moduleMapping[module.id] = newModule.id;
        }

        // Get all lessons from original modules
        if (originalModules.length > 0) {
          const originalModuleIds = originalModules.map(m => m.id);
          const originalLessons = await db.select()
            .from(schema.templateLessons)
            .where(inArray(schema.templateLessons.templateModuleId, originalModuleIds))
            .orderBy(schema.templateLessons.sortOrder);

          // Duplicate lessons
          for (const lesson of originalLessons) {
            await db.insert(schema.templateLessons).values({
              templateModuleId: moduleMapping[lesson.templateModuleId],
              title: lesson.title,
              description: lesson.description,
              resourceUrl: lesson.resourceUrl,
              sortOrder: lesson.sortOrder,
            });
          }
        }
      }

      res.status(201).json(newTemplate);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Years
  app.post("/api/university/years", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityYearSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });

      const year = await storage.createUniversityYear(validatedData);

      // If templateId is provided, copy the template structure
      if (validatedData.templateId) {
        console.log(`🔄 Starting template copy for year ${year.id} from template ${validatedData.templateId}`);

        try {
          // Get template trimesters
          const templateTrimesters = await db.select()
            .from(schema.templateTrimesters)
            .where(eq(schema.templateTrimesters.templateId, validatedData.templateId))
            .orderBy(schema.templateTrimesters.sortOrder);

          console.log(`📚 Found ${templateTrimesters.length} trimesters in template`);

          if (templateTrimesters.length === 0) {
            throw new Error(`Il template selezionato non contiene trimestri. Aggiungi trimestri, moduli e lezioni al template prima di applicarlo.`);
          }

          let totalModules = 0;
          let totalLessons = 0;

          // Copy each trimester
          for (const templateTrimester of templateTrimesters) {
            console.log(`📝 Copying trimester: ${templateTrimester.title}`);

            const [newTrimester] = await db.insert(schema.universityTrimesters)
              .values({
                yearId: year.id,
                title: templateTrimester.title,
                description: templateTrimester.description,
                sortOrder: templateTrimester.sortOrder,
              })
              .returning();

            // Get template modules for this trimester
            const templateModules = await db.select()
              .from(schema.templateModules)
              .where(eq(schema.templateModules.templateTrimesterId, templateTrimester.id))
              .orderBy(schema.templateModules.sortOrder);

            console.log(`  📦 Found ${templateModules.length} modules in trimester "${templateTrimester.title}"`);
            totalModules += templateModules.length;

            // Copy each module
            for (const templateModule of templateModules) {
              console.log(`    📋 Copying module: ${templateModule.title}`);

              const [newModule] = await db.insert(schema.universityModules)
                .values({
                  trimesterId: newTrimester.id,
                  title: templateModule.title,
                  description: templateModule.description,
                  sortOrder: templateModule.sortOrder,
                })
                .returning();

              // Get template lessons for this module
              const templateLessons = await db.select()
                .from(schema.templateLessons)
                .where(eq(schema.templateLessons.templateModuleId, templateModule.id))
                .orderBy(schema.templateLessons.sortOrder);

              console.log(`      📖 Found ${templateLessons.length} lessons in module "${templateModule.title}"`);
              totalLessons += templateLessons.length;

              // Copy each lesson
              for (const templateLesson of templateLessons) {
                console.log(`        📝 Copying lesson: "${templateLesson.title}"`);
                console.log(`           - Template lesson ID: ${templateLesson.id}`);
                console.log(`           - Library document ID: ${templateLesson.libraryDocumentId || 'NOT SET'}`);
                console.log(`           - Resource URL: ${templateLesson.resourceUrl || 'NOT SET'}`);
                
                const newLesson = await db.insert(schema.universityLessons)
                  .values({
                    moduleId: newModule.id,
                    title: templateLesson.title,
                    description: templateLesson.description,
                    resourceUrl: templateLesson.resourceUrl,
                    libraryDocumentId: templateLesson.libraryDocumentId, // 🔥 COPIA IL LIBRARY DOCUMENT ID
                    sortOrder: templateLesson.sortOrder,
                  })
                  .returning();
                
                console.log(`           ✅ Created university lesson ID: ${newLesson[0].id}`);
                console.log(`           ✅ Copied libraryDocumentId: ${newLesson[0].libraryDocumentId || 'NOT COPIED'}`);
              }
            }
          }

          console.log(`✅ Successfully copied template structure for year ${year.id}:`);
          console.log(`   - ${templateTrimesters.length} trimestri`);
          console.log(`   - ${totalModules} moduli`);
          console.log(`   - ${totalLessons} lezioni`);
        } catch (templateError: any) {
          console.error('❌ Error copying template structure:', templateError);

          // Delete the year if template copy fails
          await storage.deleteUniversityYear(year.id);

          throw new Error(`Errore durante la copia del template: ${templateError.message}`);
        }
      }

      res.status(201).json(year);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/years", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.role === "consultant" ? req.user!.id : undefined;
      const years = await storage.getUniversityYears(consultantId);
      res.json(years);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/years/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const year = await storage.getUniversityYear(req.params.id);
      if (!year) {
        return res.status(404).json({ message: "Year not found" });
      }
      res.json(year);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/years/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityYearSchema.partial().parse(req.body);
      const year = await storage.updateUniversityYear(req.params.id, updates);
      if (!year) {
        return res.status(404).json({ message: "Year not found" });
      }
      res.json(year);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/university/years/:id/lock", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { isLocked } = req.body;
      
      if (typeof isLocked !== 'boolean') {
        return res.status(400).json({ message: "isLocked must be a boolean" });
      }

      const year = await storage.getUniversityYear(req.params.id);
      if (!year) {
        return res.status(404).json({ message: "Year not found" });
      }

      // Check if user owns this year
      if (year.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedYear = await storage.updateUniversityYear(req.params.id, { isLocked });
      res.json(updatedYear);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/years/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const year = await storage.getUniversityYear(req.params.id);
      if (!year) {
        return res.status(404).json({ message: "Year not found" });
      }

      // Check if user owns this year
      if (year.createdBy !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all trimesters of this year
      const trimesters = await storage.getUniversityTrimestersByYear(req.params.id);
      const trimesterIds = trimesters.map(t => t.id);

      // Delete grades for year
      await db.delete(schema.universityGrades)
        .where(
          and(
            eq(schema.universityGrades.referenceType, "year"),
            eq(schema.universityGrades.referenceId, req.params.id)
          )
        );

      // Delete grades for trimesters
      if (trimesterIds.length > 0) {
        await db.delete(schema.universityGrades)
          .where(
            and(
              eq(schema.universityGrades.referenceType, "trimester"),
              inArray(schema.universityGrades.referenceId, trimesterIds)
            )
          );
      }

      // Delete certificates for year
      await db.delete(schema.universityCertificates)
        .where(
          and(
            eq(schema.universityCertificates.certificateType, "year"),
            eq(schema.universityCertificates.referenceId, req.params.id)
          )
        );

      // Delete certificates for trimesters
      if (trimesterIds.length > 0) {
        await db.delete(schema.universityCertificates)
          .where(
            and(
              eq(schema.universityCertificates.certificateType, "trimester"),
              inArray(schema.universityCertificates.referenceId, trimesterIds)
            )
          );
      }

      // Get all modules to delete their grades
      for (const trimester of trimesters) {
        const modules = await storage.getUniversityModulesByTrimester(trimester.id);
        const moduleIds = modules.map(m => m.id);

        if (moduleIds.length > 0) {
          await db.delete(schema.universityGrades)
            .where(
              and(
                eq(schema.universityGrades.referenceType, "module"),
                inArray(schema.universityGrades.referenceId, moduleIds)
              )
            );
        }
      }

      // Now delete the year (CASCADE will handle trimesters, modules, lessons)
      const deleted = await storage.deleteUniversityYear(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Year not found" });
      }

      res.json({ message: "Year deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting university year:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trimesters
  app.post("/api/university/trimesters", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityTrimesterSchema.parse(req.body);
      const trimester = await storage.createUniversityTrimester(validatedData);
      res.status(201).json(trimester);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/years/:yearId/trimesters", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const trimesters = await storage.getUniversityTrimestersByYear(req.params.yearId);
      res.json(trimesters);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/trimesters/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const trimester = await storage.getUniversityTrimester(req.params.id);
      if (!trimester) {
        return res.status(404).json({ message: "Trimester not found" });
      }
      res.json(trimester);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/trimesters/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityTrimesterSchema.partial().parse(req.body);
      const trimester = await storage.updateUniversityTrimester(req.params.id, updates);
      if (!trimester) {
        return res.status(404).json({ message: "Trimester not found" });
      }
      res.json(trimester);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/trimesters/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const trimester = await storage.getUniversityTrimester(req.params.id);
      if (!trimester) {
        return res.status(404).json({ message: "Trimester not found" });
      }

      // Delete grades for this trimester
      await db.delete(schema.universityGrades)
        .where(
          and(
            eq(schema.universityGrades.referenceType, "trimester"),
            eq(schema.universityGrades.referenceId, req.params.id)
          )
        );

      // Delete certificates for this trimester
      await db.delete(schema.universityCertificates)
        .where(
          and(
            eq(schema.universityCertificates.certificateType, "trimester"),
            eq(schema.universityCertificates.referenceId, req.params.id)
          )
        );

      // Delete grades for modules in this trimester
      const modules = await storage.getUniversityModulesByTrimester(req.params.id);
      const moduleIds = modules.map(m => m.id);

      if (moduleIds.length > 0) {
        await db.delete(schema.universityGrades)
          .where(
            and(
              eq(schema.universityGrades.referenceType, "module"),
              inArray(schema.universityGrades.referenceId, moduleIds)
            )
          );
      }

      const deleted = await storage.deleteUniversityTrimester(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Trimester not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting university trimester:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Modules
  app.post("/api/university/modules", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityModuleSchema.parse(req.body);
      const module = await storage.createUniversityModule(validatedData);
      res.status(201).json(module);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/trimesters/:trimesterId/modules", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const modules = await storage.getUniversityModulesByTrimester(req.params.trimesterId);
      res.json(modules);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/modules/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const module = await storage.getUniversityModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json(module);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/modules/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityModuleSchema.partial().parse(req.body);
      const module = await storage.updateUniversityModule(req.params.id, updates);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }
      res.json(module);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/modules/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const module = await storage.getUniversityModule(req.params.id);
      if (!module) {
        return res.status(404).json({ message: "Module not found" });
      }

      // Delete grades for this module
      await db.delete(schema.universityGrades)
        .where(
          and(
            eq(schema.universityGrades.referenceType, "module"),
            eq(schema.universityGrades.referenceId, req.params.id)
          )
        );

      const deleted = await storage.deleteUniversityModule(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Module not found" });
      }

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting university module:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Lessons
  app.post("/api/university/lessons", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityLessonSchema.parse(req.body);
      const lesson = await storage.createUniversityLesson(validatedData);
      res.status(201).json(lesson);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/modules/:moduleId/lessons", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const lessons = await storage.getUniversityLessonsByModule(req.params.moduleId);
      res.json(lessons);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/lessons/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const lesson = await storage.getUniversityLesson(req.params.id);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.json(lesson);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/lessons/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityLessonSchema.partial().parse(req.body);
      const lesson = await storage.updateUniversityLesson(req.params.id, updates);
      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.json(lesson);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/lessons/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteUniversityLesson(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Lesson not found" });
      }
      res.json({ message: "Lesson deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Progress
  app.put("/api/university/progress/:clientId/:lessonId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId, lessonId } = req.params;

      // Access control: clients can only update their own progress
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Consultants can update any client's progress
      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const updates = insertUniversityProgressSchema.partial().parse(req.body);

      // Build the update object with completedAt handling
      const updateData: any = { ...updates };

      // Set completedAt if marking as completed
      if (updates.isCompleted === true) {
        updateData.completedAt = new Date();
      } else if (updates.isCompleted === false) {
        updateData.completedAt = null;
      }

      const progress = await storage.updateUniversityProgress(clientId, lessonId, updateData);
      res.json(progress);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/progress/:clientId/:lessonId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId, lessonId } = req.params;

      // Access control: clients can only view their own progress
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Consultants can view their clients' progress
      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const progress = await storage.getUniversityProgress(clientId, lessonId);
      if (!progress) {
        return res.status(404).json({ message: "Progress not found" });
      }
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/progress/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const progress = await storage.getUniversityProgressByClient(clientId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Grades
  app.post("/api/university/grades", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUniversityGradeSchema.parse({
        ...req.body,
        consultantId: req.user!.id,
      });
      const grade = await storage.createUniversityGrade(validatedData);
      res.status(201).json(grade);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/grades/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const grades = await storage.getUniversityGradesByClient(clientId);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/university/grades/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const updates = insertUniversityGradeSchema.partial().parse(req.body);
      const grade = await storage.updateUniversityGrade(req.params.id, updates);
      if (!grade) {
        return res.status(404).json({ message: "Grade not found" });
      }
      res.json(grade);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/university/grades/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const deleted = await storage.deleteUniversityGrade(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Grade not found" });
      }
      res.json({ message: "Grade deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Certificates
  app.post("/api/university/certificates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientId, certificateType, referenceId } = req.body;

      // Validate required fields
      if (!clientId || !certificateType || !referenceId) {
        return res.status(400).json({ 
          message: "Parametri mancanti: clientId, certificateType e referenceId sono obbligatori" 
        });
      }

      // Validate certificate type
      if (certificateType !== "trimester" && certificateType !== "year") {
        return res.status(400).json({ 
          message: "certificateType deve essere 'trimester' o 'year'" 
        });
      }

      // Verify the consultant is associated with the client
      const client = await storage.getUser(clientId);
      if (!client) {
        return res.status(404).json({ message: "Cliente non trovato" });
      }

      if (client.consultantId !== req.user!.id) {
        return res.status(403).json({ 
          message: "Non sei autorizzato a emettere attestati per questo cliente" 
        });
      }

      // Verify the period is completed
      const isCompleted = await storage.isPeriodCompleted(
        clientId, 
        certificateType, 
        referenceId
      );

      if (!isCompleted) {
        return res.status(400).json({ 
          message: `Il ${certificateType === 'year' ? 'anno' : 'trimestre'} non è ancora completato. Tutte le lezioni devono essere completate prima di emettere l'attestato.` 
        });
      }

      // Calculate the average grade
      const averageGrade = await storage.calculatePeriodAverage(
        clientId, 
        certificateType, 
        referenceId
      );

      // Get the period title
      let periodTitle = "";
      if (certificateType === "year") {
        const year = await storage.getUniversityYear(referenceId);
        if (!year) {
          return res.status(404).json({ message: "Anno non trovato" });
        }
        periodTitle = year.title;
      } else {
        const trimester = await storage.getUniversityTrimester(referenceId);
        if (!trimester) {
          return res.status(404).json({ message: "Trimestre non trovato" });
        }
        periodTitle = trimester.title;
      }

      // Get consultant info for the certificate
      const consultant = await storage.getUser(req.user!.id);
      const consultantName = consultant ? `${consultant.firstName} ${consultant.lastName}` : undefined;

      // Generate PDF certificate
      const pdfUrl = await generateCertificatePDF({
        clientName: `${client.firstName} ${client.lastName}`,
        courseTitle: periodTitle,
        periodType: certificateType,
        issueDate: new Date(),
        averageGrade: averageGrade,
        consultantName: consultantName,
      });

      // Save certificate to database
      const certificate = await storage.createUniversityCertificate({
        clientId,
        consultantId: req.user!.id,
        certificateType,
        referenceId,
        title: periodTitle,
        averageGrade: averageGrade,
        pdfUrl,
      });

      res.status(201).json(certificate);
    } catch (error: any) {
      console.error("Error creating certificate:", error);
      res.status(500).json({ 
        message: error.message || "Errore durante la creazione dell'attestato" 
      });
    }
  });

  app.get("/api/university/certificates/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const certificates = await storage.getUniversityCertificatesByClient(clientId);
      res.json(certificates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Full structure with progress
  app.get("/api/university/structure/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      let consultantId: string | undefined;
      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        consultantId = req.user!.id;
      } else {
        // For client, get their consultant's data
        const client = await storage.getUser(clientId);
        consultantId = client?.consultantId || undefined;
      }

      const structure = await storage.getFullUniversityWithProgress(clientId, consultantId);
      res.json(structure);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Year-Client Assignments
  app.post("/api/university/years/:yearId/assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { yearId } = req.params;
      const { clientIds } = req.body; // Array of client IDs

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res.status(400).json({ message: "clientIds deve essere un array non vuoto" });
      }

      const assignments = await Promise.all(
        clientIds.map(clientId =>
          storage.createYearClientAssignment({
            yearId,
            clientId,
            consultantId: req.user!.id,
          })
        )
      );
      
      // PRIVACY ISOLATION: Sync university lessons to each client's private store
      for (const clientId of clientIds) {
        fileSearchSyncService.syncUniversityYearToClient(yearId, clientId, req.user!.id).catch(err => {
          console.error(`[FileSync] Failed to sync university year to client ${clientId}:`, err.message);
        });
      }

      res.status(201).json(assignments);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/years/:yearId/assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { yearId } = req.params;
      const assignments = await storage.getYearClientAssignments(yearId);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/university/years/:yearId/assignments/:clientId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { yearId, clientId } = req.params;
      const deleted = await storage.deleteYearClientAssignment(yearId, clientId);
      if (!deleted) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      res.json({ message: "Assignment deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/clients/:clientId/years", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const years = await storage.getYearsForClient(clientId);
      res.json(years);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get year-client assignments filtered by client IDs
  app.get("/api/university/client-year-assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientIds } = req.query;
      
      if (!clientIds) {
        return res.json([]);
      }

      const clientIdArray = (clientIds as string).split(',').filter(id => id.trim());
      
      if (clientIdArray.length === 0) {
        return res.json([]);
      }

      // Get assignments for all specified clients
      const assignments = await db.select()
        .from(schema.universityYearClientAssignments)
        .where(
          and(
            inArray(schema.universityYearClientAssignments.clientId, clientIdArray),
            eq(schema.universityYearClientAssignments.consultantId, req.user!.id)
          )
        );

      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Statistics - Overview for all clients (consultant only)
  app.get("/api/university/stats/overview", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const clients = await storage.getClientsByConsultant(req.user!.id, activeOnly);

      // Process in batches of 10 to avoid saturating database connection pool
      const batchSize = 10;
      const allStats = [];

      for (let i = 0; i < clients.length; i += batchSize) {
        const batch = clients.slice(i, i + batchSize);
        
        const statsPromises = batch.map(async (client) => {
          try {
            const stats = await storage.getUniversityStats(client.id);

            // Get current path (first assigned year)
            const years = await storage.getYearsForClient(client.id);
            const currentPath = years.length > 0 ? years[0].title : null;

            return {
              clientId: client.id,
              clientName: `${client.firstName} ${client.lastName}`,
              clientEmail: client.email,
              enrolledAt: client.enrolledAt,
              currentPath,
              ...stats
            };
          } catch (error: any) {
            console.error(`Error fetching stats for client ${client.id}:`, error.message);
            return {
              clientId: client.id,
              clientName: `${client.firstName} ${client.lastName}`,
              clientEmail: client.email,
              enrolledAt: client.enrolledAt,
              currentPath: null,
              error: error.message
            };
          }
        });

        const batchStats = await Promise.all(statsPromises);
        allStats.push(...batchStats);
      }

      res.json(allStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Statistics - Single client
  app.get("/api/university/stats/:clientId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== clientId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (req.user!.role === "consultant") {
        const client = await storage.getUser(clientId);
        if (!client || client.consultantId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const stats = await storage.getUniversityStats(clientId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User Badges
  app.get("/api/badges/:userId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;

      // Access control
      if (req.user!.role === "client" && req.user!.id !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const badges = await db.select().from(schema.userBadges).where(eq(schema.userBadges.userId, userId));
      res.json(badges);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/badges", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const validatedData = insertUserBadgeSchema.parse(req.body);

      // Check if badge already exists
      const existing = await db.select().from(schema.userBadges)
        .where(eq(schema.userBadges.userId, validatedData.userId))
        .where(eq(schema.userBadges.badgeType, validatedData.badgeType));

      if (existing.length > 0) {
        return res.status(409).json({ message: "Badge already earned" });
      }

      const badge = await db.insert(schema.userBadges).values(validatedData).returning();
      res.status(201).json(badge[0]);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Update user level
  app.put("/api/users/:userId/level", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      const { level } = req.body;

      if (!["studente", "esperto", "mentor", "master"].includes(level)) {
        return res.status(400).json({ message: "Invalid level" });
      }

      const user = await db.update(schema.users)
        .set({ level })
        .where(eq(schema.users.id, userId))
        .returning();

      if (!user[0]) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user[0]);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Auto-calculate and update user level based on university completion
  app.put("/api/university/stats/:clientId/update-level", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;

      // Get university stats for client
      const stats = await storage.getUniversityStats(clientId);
      const completionPercentage = stats.completionPercentage || 0;

      // Calculate level based on completion percentage
      let level: "studente" | "esperto" | "mentor" | "master" = "studente";
      if (completionPercentage >= 76) {
        level = "master";
      } else if (completionPercentage >= 51) {
        level = "mentor";
      } else if (completionPercentage >= 26) {
        level = "esperto";
      }

      // Update user level
      const user = await db.update(schema.users)
        .set({ level })
        .where(eq(schema.users.id, clientId))
        .returning();

      if (!user[0]) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ level, completionPercentage, user: user[0] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client-specific endpoints (no clientId param, uses logged-in user)
  app.post("/api/university/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const { lessonId, isCompleted, notes } = req.body;

      const updates: any = {};
      if (isCompleted !== undefined) {
        updates.isCompleted = isCompleted;
        updates.completedAt = isCompleted ? new Date() : null;
      }
      if (notes !== undefined) {
        updates.notes = notes;
      }

      const progress = await storage.updateUniversityProgress(clientId, lessonId, updates);

      const earnedBadges: any[] = [];

      // If marking lesson as completed, check for badge assignments and level updates
      if (isCompleted === true) {
        // Update user level based on completion percentage
        try {
          const stats = await storage.getUniversityStats(clientId);
          const completionPercentage = stats.completionPercentage || 0;

          let level: "studente" | "esperto" | "mentor" | "master" = "studente";
          if (completionPercentage >= 76) {
            level = "master";
          } else if (completionPercentage >= 51) {
            level = "mentor";
          } else if (completionPercentage >= 26) {
            level = "esperto";
          }

          await db.update(schema.users)
            .set({ level })
            .where(eq(schema.users.id, clientId));

          // Award level badges
          if (level === "master" || completionPercentage >= 76) {
            const existing = await db.select().from(schema.userBadges)
              .where(eq(schema.userBadges.userId, clientId))
              .where(eq(schema.userBadges.badgeType, "master"));

            if (existing.length === 0) {
              const badge = await db.insert(schema.userBadges).values({
                userId: clientId,
                badgeType: "master",
                badgeName: "Master",
                badgeDescription: "Hai raggiunto il livello Master completando più del 75% dell'università",
              }).returning();
              earnedBadges.push(badge[0]);
            }
          } else if (level === "mentor" || completionPercentage >= 51) {
            const existing = await db.select().from(schema.userBadges)
              .where(eq(schema.userBadges.userId, clientId))
              .where(eq(schema.userBadges.badgeType, "mentor"));

            if (existing.length === 0) {
              const badge = await db.insert(schema.userBadges).values({
                userId: clientId,
                badgeType: "mentor",
                badgeName: "Mentor",
                badgeDescription: "Hai raggiunto il livello Mentor completando più del 50% dell'università",
              }).returning();
              earnedBadges.push(badge[0]);
            }
          } else if (level === "esperto" || completionPercentage >= 26) {
            const existing = await db.select().from(schema.userBadges)
              .where(eq(schema.userBadges.userId, clientId))
              .where(eq(schema.userBadges.badgeType, "esperto"));

            if (existing.length === 0) {
              const badge = await db.insert(schema.userBadges).values({
                userId: clientId,
                badgeType: "esperto",
                badgeName: "Esperto",
                badgeDescription: "Hai raggiunto il livello Esperto completando più del 25% dell'università",
              }).returning();
              earnedBadges.push(badge[0]);
            }
          }

          // Check for "Perfezionista" badge (100% completion)
          if (completionPercentage >= 100) {
            const existing = await db.select().from(schema.userBadges)
              .where(eq(schema.userBadges.userId, clientId))
              .where(eq(schema.userBadges.badgeType, "perfezionista"));

            if (existing.length === 0) {
              const badge = await db.insert(schema.userBadges).values({
                userId: clientId,
                badgeType: "perfezionista",
                badgeName: "Perfezionista",
                badgeDescription: "Hai completato il 100% dell'università!",
              }).returning();
              earnedBadges.push(badge[0]);
            }
          }
        } catch (error) {
          console.error("Error updating level:", error);
        }

        // Check for "Prima Lezione" badge
        try {
          const completedLessons = await db.select().from(schema.universityProgress)
            .where(eq(schema.universityProgress.clientId, clientId))
            .where(eq(schema.universityProgress.isCompleted, true));

          if (completedLessons.length === 1) {
            const existing = await db.select().from(schema.userBadges)
              .where(eq(schema.userBadges.userId, clientId))
              .where(eq(schema.userBadges.badgeType, "prima_lezione"));

            if (existing.length === 0) {
              const badge = await db.insert(schema.userBadges).values({
                userId: clientId,
                badgeType: "prima_lezione",
                badgeName: "Prima Lezione",
                badgeDescription: "Hai completato la tua prima lezione!",
              }).returning();
              earnedBadges.push(badge[0]);
            }
          }
        } catch (error) {
          console.error("Error checking first lesson badge:", error);
        }

        // Check for trimester and year completion badges
        try {
          // Get the lesson details to find module, trimester, and year
          const lesson = await db.select().from(schema.universityLessons)
            .where(eq(schema.universityLessons.id, lessonId))
            .limit(1);

          if (lesson.length > 0) {
            const moduleId = lesson[0].moduleId;

            // Get module details
            const module = await db.select().from(schema.universityModules)
              .where(eq(schema.universityModules.id, moduleId))
              .limit(1);

            if (module.length > 0) {
              const trimesterId = module[0].trimesterId;

              // Get trimester details
              const trimester = await db.select().from(schema.universityTrimesters)
                .where(eq(schema.universityTrimesters.id, trimesterId))
                .limit(1);

              if (trimester.length > 0) {
                const yearId = trimester[0].yearId;

                // Check if all lessons in trimester are completed
                const trimesterModules = await db.select().from(schema.universityModules)
                  .where(eq(schema.universityModules.trimesterId, trimesterId));

                const moduleIds = trimesterModules.map(m => m.id);

                const trimesterLessons = await db.select().from(schema.universityLessons)
                  .where(sql`${schema.universityLessons.moduleId} = ANY(${moduleIds})`);

                const trimesterProgress = await db.select().from(schema.universityProgress)
                  .where(eq(schema.universityProgress.clientId, clientId))
                  .where(sql`${schema.universityProgress.lessonId} = ANY(${trimesterLessons.map(l => l.id)})`);

                const allTrimesterCompleted = trimesterLessons.length > 0 && 
                  trimesterProgress.filter(p => p.isCompleted).length === trimesterLessons.length;

                if (allTrimesterCompleted) {
                  // Check for first trimester badge
                  const trimesterBadges = await db.select().from(schema.userBadges)
                    .where(eq(schema.userBadges.userId, clientId))
                    .where(eq(schema.userBadges.badgeType, "primo_trimestre"));

                  if (trimesterBadges.length === 0) {
                    const badge = await db.insert(schema.userBadges).values({
                      userId: clientId,
                      badgeType: "primo_trimestre",
                      badgeName: "Primo Trimestre",
                      badgeDescription: "Hai completato il tuo primo trimestre!",
                    }).returning();
                    earnedBadges.push(badge[0]);
                  }

                  // Check if all trimesters in year are completed
                  const yearTrimesters = await db.select().from(schema.universityTrimesters)
                    .where(eq(schema.universityTrimesters.yearId, yearId));

                  let allYearCompleted = true;
                  for (const t of yearTrimesters) {
                    const tModules = await db.select().from(schema.universityModules)
                      .where(eq(schema.universityModules.trimesterId, t.id));

                    const tModuleIds = tModules.map(m => m.id);

                    const tLessons = await db.select().from(schema.universityLessons)
                      .where(sql`${schema.universityLessons.moduleId} = ANY(${tModuleIds})`);

                    const tProgress = await db.select().from(schema.universityProgress)
                      .where(eq(schema.universityProgress.clientId, clientId))
                      .where(sql`${schema.universityProgress.lessonId} = ANY(${tLessons.map(l => l.id)})`);

                    if (tLessons.length === 0 || tProgress.filter(p => p.isCompleted).length !== tLessons.length) {
                      allYearCompleted = false;
                      break;
                    }
                  }

                  if (allYearCompleted && yearTrimesters.length > 0) {
                    // Check for year completion badge
                    const yearBadges = await db.select().from(schema.userBadges)
                      .where(eq(schema.userBadges.userId, clientId))
                      .where(eq(schema.userBadges.badgeType, "anno_completato"));

                    if (yearBadges.length === 0) {
                      const badge = await db.insert(schema.userBadges).values({
                        userId: clientId,
                        badgeType: "anno_completato",
                        badgeName: "Anno Completato",
                        badgeDescription: "Hai completato un anno intero!",
                      }).returning();
                      earnedBadges.push(badge[0]);
                    }

                    // Check for "Velocista" badge (year completed in less than 30 days)
                    const yearAssignment = await db.select().from(schema.universityYearClientAssignments)
                      .where(eq(schema.universityYearClientAssignments.yearId, yearId))
                      .where(eq(schema.universityYearClientAssignments.clientId, clientId))
                      .limit(1);

                    if (yearAssignment.length > 0) {
                      const assignedDate = new Date(yearAssignment[0].assignedAt);
                      const now = new Date();
                      const daysDiff = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24));

                      if (daysDiff < 30) {
                        const velocistaBadges = await db.select().from(schema.userBadges)
                          .where(eq(schema.userBadges.userId, clientId))
                          .where(eq(schema.userBadges.badgeType, "velocista"));

                        if (velocistaBadges.length === 0) {
                          const badge = await db.insert(schema.userBadges).values({
                            userId: clientId,
                            badgeType: "velocista",
                            badgeName: "Velocista",
                            badgeDescription: "Hai completato un anno in meno di 30 giorni!",
                          }).returning();
                          earnedBadges.push(badge[0]);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error checking trimester/year completion:", error);
        }
      }

      res.json({ progress, earnedBadges });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/university/progress", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const progress = await storage.getUniversityProgressByClient(clientId);
      res.json(progress);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/stats", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const stats = await storage.getUniversityStats(clientId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/structure", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const client = await storage.getUser(clientId);
      const consultantId = client?.consultantId || undefined;

      const structure = await storage.getFullUniversityWithProgress(clientId, consultantId);
      res.json(structure);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/university/grades", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const clientId = req.user!.id;
      const grades = await storage.getUniversityGradesByClient(clientId);
      res.json(grades);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI Assistant Routes
  const aiService = await import("./ai-service");

  app.post("/api/ai/chat", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { message, conversationId, mode, consultantType, pageContext, hasPageContext, focusedDocument } = req.body;
      
      if (!message || !mode) {
        return res.status(400).json({ message: "Message and mode are required" });
      }

      if (mode !== 'assistenza' && mode !== 'consulente') {
        return res.status(400).json({ message: "Invalid mode. Must be 'assistenza' or 'consulente'" });
      }

      if (mode === 'consulente' && !consultantType) {
        return res.status(400).json({ message: "Consultant type is required for consulente mode" });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      
      // CRITICAL: Disable TCP buffering for real-time streaming
      if (res.socket) {
        res.socket.setNoDelay(true);
      }
      
      // Flush headers immediately to start streaming
      res.flushHeaders();

      // Stream AI response
      try {
        for await (const chunk of aiService.sendChatMessageStream({
          clientId: req.user!.id,
          message,
          conversationId,
          mode,
          consultantType,
          pageContext,
          focusedDocument,
          // Email Condivisa: Pass active profile role and consultantId for mixed-role users
          userRole: req.user!.role as 'consultant' | 'client',
          activeConsultantId: req.user!.consultantId,
        })) {
          // Send chunk as SSE event and flush immediately
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          
          // Force flush to send chunk immediately (not buffered)
          if ('flush' in res && typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
        
        // End the stream
        res.end();
      } catch (streamError: any) {
        console.error("Error during AI streaming:", streamError);
        
        // Send error chunk if not already ended
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: "error",
            conversationId: conversationId || "",
            error: "Mi dispiace, si è verificato un errore. Riprova.",
            content: "Mi dispiace, si è verificato un errore. Riprova.",
          })}\n\n`);
          res.end();
        }
      }
    } catch (error: any) {
      console.error("Error in AI chat:", error);
      
      // If headers not sent yet, send JSON error
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || "Error processing chat request" });
      } else if (!res.writableEnded) {
        // If SSE already started, send error event
        res.write(`data: ${JSON.stringify({
          type: "error",
          conversationId: "",
          error: error.message || "Error processing chat request",
          content: error.message || "Error processing chat request",
        })}\n\n`);
        res.end();
      }
    }
  });

  // Lead Hub Assistant endpoint for consultants
  app.post("/api/ai/lead-hub-assistant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { question } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ success: false, message: "Question is required" });
      }

      const consultantId = req.user!.id;
      
      // Get AI provider for the consultant
      const aiProvider = await getAIProvider(consultantId, consultantId);
      
      if (!aiProvider.client) {
        return res.status(500).json({ 
          success: false, 
          message: "AI provider not available. Please configure your AI settings." 
        });
      }

      const systemPrompt = `Sei un assistente AI specializzato nel Lead Hub di Orbitale CRM.
Il tuo ruolo è aiutare i consulenti finanziari a:

1. **Gestione Lead Proattivi**: Importazione contatti da Excel/CSV, segmentazione, tagging, lead scoring
2. **Campagne**: Creazione campagne marketing, pianificazione invii, segmentazione pubblico, analisi metriche
3. **Template WhatsApp**: Selezione template approvati Meta, personalizzazione con variabili, best practice messaggistica
4. **Template Personalizzati**: Creazione template custom, processo approvazione Meta, header/footer/pulsanti
5. **Automazioni**: Follow-up automatici, AI responder, regole pipeline, notifiche intelligenti

Rispondi in italiano, in modo conciso e pratico. Fornisci suggerimenti actionable.
Se non conosci una risposta specifica, suggerisci dove trovare più informazioni nella piattaforma.`;

      const { model, useThinking, thinkingLevel } = getModelWithThinking(aiProvider.metadata.name);
      console.log(`[AI] Using model: ${model} with thinking: ${useThinking ? thinkingLevel : 'disabled'}`);
      
      const result = await aiProvider.client.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: question }] }
        ],
        generationConfig: {
          systemInstruction: systemPrompt,
          maxOutputTokens: 1024,
          temperature: 0.7,
          ...(useThinking && { thinkingConfig: { thinkingLevel } }),
        },
      });

      const response = result.response.text();

      res.json({ 
        success: true, 
        response: response 
      });

    } catch (error: any) {
      console.error("Error in Lead Hub Assistant:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error processing request" 
      });
    }
  });

  app.get("/api/ai/conversations", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const conversations = await aiService.getConversations(req.user!.id);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/conversations/:id", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const data = await aiService.getConversationMessages(id, req.user!.id);
      res.json(data);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  app.delete("/api/ai/conversations/:id", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await aiService.deleteConversation(id, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  app.get("/api/ai/preferences", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const preferences = await aiService.getUserPreferences(req.user!.id);
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/daily-briefing", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const briefing = await aiService.buildDailyBriefing(req.user!.id);
      res.json({ briefing });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai/messages/:messageId", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
    try {
      const { messageId } = req.params;
      
      // Get message
      const [message] = await db.select()
        .from(schema.aiMessages)
        .where(eq(schema.aiMessages.id, messageId))
        .limit(1);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Verify message belongs to client's conversation
      const [conversation] = await db.select()
        .from(schema.aiConversations)
        .where(eq(schema.aiConversations.id, message.conversationId))
        .limit(1);
      
      if (!conversation || conversation.clientId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========================================
  // CONSULTANT AI ASSISTANT ROUTES
  // ========================================

  app.post("/api/consultant/ai/chat", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { message, conversationId, pageContext, focusedDocument } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      if (res.socket) {
        res.socket.setNoDelay(true);
      }
      
      res.flushHeaders();

      // Stream AI response for consultant
      try {
        for await (const chunk of aiService.sendConsultantChatMessageStream({
          consultantId: req.user!.id,
          message,
          conversationId,
          pageContext,
          focusedDocument,
        })) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          
          if ('flush' in res && typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }
        
        res.end();
      } catch (streamError: any) {
        console.error("Error during consultant AI streaming:", streamError);
        
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({
            type: "error",
            conversationId: conversationId || "",
            content: "Mi dispiace, si è verificato un errore. Riprova.",
          })}\n\n`);
          res.end();
        }
      }
    } catch (error: any) {
      console.error("Error in consultant AI chat:", error);
      
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || "Error processing chat request" });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({
          type: "error",
          conversationId: "",
          content: error.message || "Error processing chat request",
        })}\n\n`);
        res.end();
      }
    }
  });

  app.get("/api/consultant/ai/conversations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const conversations = await aiService.getConsultantConversations(req.user!.id);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/consultant/ai/conversations/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const data = await aiService.getConsultantConversationMessages(id, req.user!.id);
      res.json(data);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  app.delete("/api/consultant/ai/conversations/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await aiService.deleteConsultantConversation(id, req.user!.id);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ message: error.message });
    }
  });

  // ========================================
  // CONSULTANT PROFILE ROUTES
  // ========================================

  // Get consultant profile
  app.get("/api/consultant/profile", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber || "",
      });
    } catch (error: any) {
      console.error("Error fetching consultant profile:", error);
      res.status(500).json({ message: error.message || "Failed to fetch profile" });
    }
  });

  // Update consultant profile
  app.post("/api/consultant/profile", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { firstName, lastName, phoneNumber } = req.body;

      // Validate required fields
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }

      // Validate phone number format if provided
      if (phoneNumber) {
        // Remove spaces and common separators
        const cleaned = phoneNumber.replace(/[\s\-\.]/g, "");
        
        // Valid formats: +393501234567, 3501234567, 00393501234567
        const phoneRegex = /^(\+39|0039)?3\d{8,9}$/;
        
        if (!phoneRegex.test(cleaned)) {
          return res.status(400).json({ 
            message: "Invalid phone number format. Use +393501234567 or 3501234567" 
          });
        }
      }

      // Update user in database
      await db.update(schema.users)
        .set({
          firstName,
          lastName,
          phoneNumber: phoneNumber || null,
        })
        .where(eq(schema.users.id, req.user!.id));

      // Fetch updated user
      const updatedUser = await storage.getUser(req.user!.id);

      res.json({
        message: "Profile updated successfully",
        user: {
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          email: updatedUser!.email,
          phoneNumber: updatedUser!.phoneNumber || "",
        },
      });
    } catch (error: any) {
      console.error("Error updating consultant profile:", error);
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  // ========================================
  // TASK 8: CONSULTANT VERTEX PREFERENCE
  // ========================================

  // GET /api/consultant/vertex-preference - Get consultant's useSuperadminVertex preference
  app.get("/api/consultant/vertex-preference", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const [consultant] = await db
        .select({
          useSuperadminVertex: schema.users.useSuperadminVertex,
        })
        .from(schema.users)
        .where(eq(schema.users.id, req.user!.id))
        .limit(1);

      if (!consultant) {
        return res.status(404).json({ success: false, message: "Consultant not found" });
      }

      // Also check if SuperAdmin has given this consultant access
      const [accessRecord] = await db
        .select({ hasAccess: schema.consultantVertexAccess.hasAccess })
        .from(schema.consultantVertexAccess)
        .where(eq(schema.consultantVertexAccess.consultantId, req.user!.id))
        .limit(1);

      // Check if SuperAdmin Vertex config exists and is enabled
      const [superadminConfig] = await db
        .select({ enabled: schema.superadminVertexConfig.enabled })
        .from(schema.superadminVertexConfig)
        .where(eq(schema.superadminVertexConfig.enabled, true))
        .limit(1);

      // Check if consultant has their own Vertex AI settings
      const [ownVertexSettings] = await db
        .select({ id: schema.vertexAiSettings.id, enabled: schema.vertexAiSettings.enabled })
        .from(schema.vertexAiSettings)
        .where(eq(schema.vertexAiSettings.userId, req.user!.id))
        .limit(1);

      // Combine: SuperAdmin config must exist AND consultant must have access
      const hasAccessFromSuperAdmin = accessRecord?.hasAccess ?? true; // Default true if no record exists
      const superAdminVertexAvailable = !!superadminConfig && hasAccessFromSuperAdmin;
      const hasOwnVertex = !!ownVertexSettings && ownVertexSettings.enabled !== false;

      res.json({
        success: true,
        useSuperAdminVertex: consultant.useSuperadminVertex ?? true,
        hasOwnVertex: hasOwnVertex,
        superAdminVertexAvailable: superAdminVertexAvailable,
        hasAccessFromSuperAdmin: hasAccessFromSuperAdmin,
      });
    } catch (error: any) {
      console.error("Error fetching consultant vertex preference:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to fetch preference" });
    }
  });

  // PUT /api/consultant/vertex-preference - Toggle consultant's useSuperadminVertex preference
  app.put("/api/consultant/vertex-preference", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { useSuperadminVertex } = req.body;

      if (typeof useSuperadminVertex !== "boolean") {
        return res.status(400).json({ success: false, message: "useSuperadminVertex must be a boolean" });
      }

      // Update the consultant's preference
      await db
        .update(schema.users)
        .set({ useSuperadminVertex })
        .where(eq(schema.users.id, req.user!.id));

      console.log(`✅ Consultant ${req.user!.id} updated useSuperadminVertex to ${useSuperadminVertex}`);

      res.json({
        success: true,
        useSuperadminVertex,
        message: useSuperadminVertex 
          ? "Ora utilizzi Vertex AI del SuperAdmin" 
          : "Ora utilizzi la tua configurazione Vertex AI personale",
      });
    } catch (error: any) {
      console.error("Error updating consultant vertex preference:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to update preference" });
    }
  });

  // GET /api/consultant/gemini-preference - Get consultant's Gemini API preference
  app.get("/api/consultant/gemini-preference", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const [consultant] = await db
        .select({
          useSuperadminGemini: schema.users.useSuperadminGemini,
          geminiApiKeys: schema.users.geminiApiKeys,
        })
        .from(schema.users)
        .where(eq(schema.users.id, consultantId))
        .limit(1);

      if (!consultant) {
        return res.status(404).json({ success: false, message: "Consultant not found" });
      }

      const [superadminConfig] = await db
        .select({ enabled: schema.superadminGeminiConfig.enabled })
        .from(schema.superadminGeminiConfig)
        .limit(1);

      const superAdminGeminiAvailable = !!superadminConfig && superadminConfig.enabled !== false;
      const hasOwnGeminiKeys = (consultant.geminiApiKeys?.length ?? 0) > 0;

      res.json({
        success: true,
        useSuperAdminGemini: consultant.useSuperadminGemini ?? true,
        hasOwnGeminiKeys: hasOwnGeminiKeys,
        superAdminGeminiAvailable: superAdminGeminiAvailable,
      });
    } catch (error: any) {
      console.error("Error fetching consultant gemini preference:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to fetch preference" });
    }
  });

  // PUT /api/consultant/gemini-preference - Toggle consultant's useSuperadminGemini preference
  app.put("/api/consultant/gemini-preference", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { useSuperadminGemini } = req.body;

      if (typeof useSuperadminGemini !== "boolean") {
        return res.status(400).json({ success: false, message: "useSuperadminGemini must be a boolean" });
      }

      await db
        .update(schema.users)
        .set({ useSuperadminGemini })
        .where(eq(schema.users.id, req.user!.id));

      console.log(`✅ Consultant ${req.user!.id} updated useSuperadminGemini to ${useSuperadminGemini}`);

      res.json({
        success: true,
        useSuperadminGemini,
        message: useSuperadminGemini 
          ? "Ora utilizzi le API keys Gemini del SuperAdmin" 
          : "Ora utilizzi le tue API keys Gemini personali",
      });
    } catch (error: any) {
      console.error("Error updating consultant gemini preference:", error);
      res.status(500).json({ success: false, message: error.message || "Failed to update preference" });
    }
  });

  // Web scraping endpoint - REMOVED for security (SSRF protection)
  // Scraping is only done internally for exercise platforms

  // Finance Settings routes (Percorso Capitale integration)
  app.use("/api/finance-settings", financeSettingsRouter);

  // Consultation Tasks routes
  app.use("/api", consultationTasksRouter);

  // Client State Tracking routes
  app.use("/api", clientStateRouter);

  // Automated Emails routes
  app.use("/api", automatedEmailsRouter);

  // Momentum routes
  app.use("/api/momentum", momentumRouter);

  // Proactive Leads routes
  app.use("/api", proactiveLeadsRouter);

  // Marketing Campaigns routes
  app.use("/api", campaignsRouter);

  // WhatsApp Custom Templates routes
  app.use("/api", customTemplatesRouter);

  // WhatsApp Template Assignments routes
  app.use("/api/whatsapp/template-assignments", templateAssignmentsRouter);

  // WhatsApp Template Approval Status routes
  app.use("/api/whatsapp/templates", templateApprovalRouter);

  // WhatsApp Agent Share routes (public agent sharing)
  app.use("/api/whatsapp/agent-share", agentShareRouter);

  // Public WhatsApp Agent Share routes (unauthenticated access)
  app.use("/public/whatsapp/shares", publicShareRouter);

  // WhatsApp Template Export to Twilio routes
  app.use("/api", twilioTemplateExportRouter);

  // WhatsApp Agent Instructions Configuration routes
  app.use("/api", agentInstructionsRouter);

  // WhatsApp Agent Knowledge Base routes
  app.use("/api", agentKnowledgeRouter);

  // WhatsApp Agent Stats & Analytics routes
  app.use("/api/whatsapp/agents", agentStatsRouter);

  // Live Prompts routes (requires authentication)
  // Scoped to /api/live-prompts to avoid intercepting other /api routes
  app.use("/api/live-prompts", authenticateToken, livePromptsRouter);

  // AI Consultations routes (requires authentication)
  app.use("/api/consultations/ai", aiConsultationsRouter);

  // Client Sales Agent Configuration routes (requires authentication)
  app.use("/api/client/sales-agent/config", salesAgentConfigRouter);
  app.use("/api/client/sales-agent/knowledge", salesAgentKnowledgeRouter);

  // Public Sales Agent routes (unauthenticated access for prospects)
  app.use("/api/public/sales-agent", publicSalesAgentRouter);

  // Public Consultation Invites routes (unauthenticated access for prospects via invite links)
  app.use("/api/public/invite", publicConsultationInvitesRouter);

  // Public Video Meeting routes (unauthenticated access for guests joining meetings)
  app.use("/api/public/meeting", publicVideoMeetingRouter);

  // External API Lead Import routes
  app.use("/api/external-api", externalApiRouter);

  // Webhook routes (public endpoints for receiving leads from external systems)
  app.use("/api/webhook", webhookRouter);

  // Training Assistant routes
  app.use("/api/training", trainingAssistantRouter);

  // AI Trainer routes (Campo di Battaglia)
  app.use("/api/ai-trainer", aiTrainerRouter);

  // Sales Scripts Management routes (for editing scripts from frontend)
  app.use("/api/sales-scripts", authenticateToken, salesScriptsRouter);

  // Script Builder routes (visual script construction)
  app.use("/api/script-builder", authenticateToken, scriptBuilderRouter);

  // Human Sellers & Video Meetings routes
  app.use("/api/client/human-sellers", humanSellersRouter);
  
  // Public Meeting Access routes (unauthenticated for green room)
  app.use("/api/meet", publicMeetRouter);

  // Consultant Knowledge Base Documents routes
  app.use("/api", knowledgeDocumentsRouter);

  // Consultant Knowledge Base APIs routes
  app.use("/api", knowledgeApisRouter);

  // Client Knowledge Base Documents routes
  app.use("/api", clientKnowledgeDocumentsRouter);

  // Client Knowledge Base APIs routes
  app.use("/api", clientKnowledgeApisRouter);

  // Google Drive Integration routes
  app.use("/api", googleDriveRouter);
  app.use("/api", clientGoogleDriveRouter);

  // Super Admin routes
  app.use("/api", adminRouter);

  // Consultant Onboarding routes
  app.use("/api/consultant/onboarding", onboardingRouter);

  // Consultant Credential Notes - GET and PUT for account reference and notes per step
  app.get("/api/consultant/credential-notes/:stepId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { stepId } = req.params;
      const consultantId = req.user!.id;

      let result: { accountReference: string | null; notes: string | null } = { accountReference: null, notes: null };

      switch (stepId) {
        case "vertex_ai": {
          const [settings] = await db.select({
            accountReference: schema.vertexAiSettings.accountReference,
            notes: schema.vertexAiSettings.notes,
          }).from(schema.vertexAiSettings).where(eq(schema.vertexAiSettings.userId, consultantId));
          if (settings) {
            result = { accountReference: settings.accountReference, notes: settings.notes };
          }
          break;
        }
        case "smtp": {
          const [settings] = await db.select({
            accountReference: schema.consultantSmtpSettings.accountReference,
            notes: schema.consultantSmtpSettings.notes,
          }).from(schema.consultantSmtpSettings).where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
          if (settings) {
            result = { accountReference: settings.accountReference, notes: settings.notes };
          }
          break;
        }
        case "twilio_config": {
          const [config] = await db.select({
            accountReference: schema.consultantWhatsappConfig.twilioAccountReference,
            notes: schema.consultantWhatsappConfig.twilioNotes,
          }).from(schema.consultantWhatsappConfig).where(eq(schema.consultantWhatsappConfig.consultantId, consultantId)).limit(1);
          if (config) {
            result = { accountReference: config.accountReference, notes: config.notes };
          }
          break;
        }
        case "google_calendar": {
          const [config] = await db.select({
            accountReference: schema.consultantWhatsappConfig.googleCalendarAccountReference,
            notes: schema.consultantWhatsappConfig.googleCalendarNotes,
          }).from(schema.consultantWhatsappConfig).where(eq(schema.consultantWhatsappConfig.consultantId, consultantId)).limit(1);
          if (config) {
            result = { accountReference: config.accountReference, notes: config.notes };
          }
          break;
        }
        default:
          return res.status(400).json({ message: "Step non supportato" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("[CREDENTIAL-NOTES] Error fetching:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/consultant/credential-notes/:stepId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { stepId } = req.params;
      const consultantId = req.user!.id;
      const { accountReference, notes } = req.body;

      switch (stepId) {
        case "vertex_ai": {
          const [existing] = await db.select({ id: schema.vertexAiSettings.id }).from(schema.vertexAiSettings).where(eq(schema.vertexAiSettings.userId, consultantId));
          if (existing) {
            await db.update(schema.vertexAiSettings).set({
              accountReference,
              notes,
              updatedAt: new Date(),
            }).where(eq(schema.vertexAiSettings.userId, consultantId));
          }
          break;
        }
        case "smtp": {
          const [existing] = await db.select({ id: schema.consultantSmtpSettings.id }).from(schema.consultantSmtpSettings).where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
          if (existing) {
            await db.update(schema.consultantSmtpSettings).set({
              accountReference,
              notes,
              updatedAt: new Date(),
            }).where(eq(schema.consultantSmtpSettings.consultantId, consultantId));
          }
          break;
        }
        case "twilio_config": {
          const [existing] = await db.select({ id: schema.consultantWhatsappConfig.id }).from(schema.consultantWhatsappConfig).where(eq(schema.consultantWhatsappConfig.consultantId, consultantId)).limit(1);
          if (existing) {
            await db.update(schema.consultantWhatsappConfig).set({
              twilioAccountReference: accountReference,
              twilioNotes: notes,
              updatedAt: new Date(),
            }).where(eq(schema.consultantWhatsappConfig.id, existing.id));
          }
          break;
        }
        case "google_calendar": {
          const [existing] = await db.select({ id: schema.consultantWhatsappConfig.id }).from(schema.consultantWhatsappConfig).where(eq(schema.consultantWhatsappConfig.consultantId, consultantId)).limit(1);
          if (existing) {
            await db.update(schema.consultantWhatsappConfig).set({
              googleCalendarAccountReference: accountReference,
              googleCalendarNotes: notes,
              updatedAt: new Date(),
            }).where(eq(schema.consultantWhatsappConfig.id, existing.id));
          }
          break;
        }
        default:
          return res.status(400).json({ message: "Step non supportato" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CREDENTIAL-NOTES] Error saving:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Follow-up Automation API routes
  app.use("/api/followup", followupApiRouter);

  // Gemini File Search routes (RAG document retrieval)
  app.use("/api/file-search", fileSearchRouter);

  // Echo - AI Consultation Summary Email System
  app.use("/api/echo", authenticateToken, echoRouter);

  // Calendar Events routes
  app.get("/api/calendar/events", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
      const endDate = req.query.end ? new Date(req.query.end as string) : undefined;
      
      const events = await storage.getCalendarEventsByUser(req.user!.id, startDate, endDate);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/calendar/events", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const eventData = {
        ...req.body,
        userId: req.user!.id,
        start: new Date(req.body.start),
        end: new Date(req.body.end),
      };
      
      const event = await storage.createCalendarEvent(eventData);
      res.status(201).json(event);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/calendar/events/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getCalendarEvent(id);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event belongs to current user
      if (event.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/calendar/events/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getCalendarEvent(id);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event belongs to current user
      if (event.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updates = {
        ...req.body,
        ...(req.body.start && { start: new Date(req.body.start) }),
        ...(req.body.end && { end: new Date(req.body.end) }),
      };
      
      const updatedEvent = await storage.updateCalendarEvent(id, updates);
      res.json(updatedEvent);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/calendar/events/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getCalendarEvent(id);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check if event belongs to current user
      if (event.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteCalendarEvent(id);
      res.json({ message: "Event deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ===== EMAIL JOURNEY ROUTES (Tasks 11-12) =====
  
  // GET /api/email-journey-templates - Lista tutti i 31 template (28 standard + 3 extra per mesi lunghi)
  app.get("/api/email-journey-templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const templates = await storage.getAllEmailJourneyTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // PUT /api/email-journey-templates/:id - Aggiorna un template
  app.put("/api/email-journey-templates/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Validate update fields
      const allowedFields = ['title', 'description', 'promptTemplate', 'tone', 'priority', 'isActive'];
      const filteredUpdates: any = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      }
      
      const updated = await storage.updateEmailJourneyTemplate(id, filteredUpdates);
      
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });
  
  // GET /api/email-journey-progress/:clientId - Progresso journey di un cliente specifico
  app.get("/api/email-journey-progress/:clientId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.params;
      
      // Verify client belongs to consultant
      const client = await storage.getUser(clientId);
      if (!client || client.consultantId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const progress = await storage.getClientEmailJourneyProgress(req.user!.id, clientId);
      
      if (!progress) {
        return res.status(404).json({ message: "No journey progress found for this client" });
      }
      
      // Enrich with template info using current calendar day
      const now = new Date();
      const currentDay = now.getDate(); // Get day of month (1-31) from current date
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      
      // Get current template using dynamic selection
      const templateDay = calculateTemplateDay(currentDay, lastDayOfMonth);
      const currentTemplate = await storage.getEmailJourneyTemplate(templateDay);
      
      // Get next template (for "what's coming next" preview)
      let nextDay = currentDay + 1;
      let nextTemplate = null;
      
      // Check if we're at end of month
      if (nextDay > lastDayOfMonth) {
        // Month ended - next template is day 1 of new cycle
        nextDay = 1;
        nextTemplate = await storage.getEmailJourneyTemplate(1);
      } else {
        // Next day is still within current month
        const nextTemplateDay = calculateTemplateDay(nextDay, lastDayOfMonth);
        nextTemplate = await storage.getEmailJourneyTemplate(nextTemplateDay);
      }
      
      // Get SMTP settings for emailFrequencyDays
      const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);
      const emailFrequencyDays = smtpSettings?.emailFrequencyDays || 2;
      
      // Calculate next email date
      let nextEmailDate = null;
      if (progress.lastEmailSentAt) {
        const lastSent = new Date(progress.lastEmailSentAt);
        nextEmailDate = new Date(lastSent.getTime() + emailFrequencyDays * 24 * 60 * 60 * 1000);
      }
      
      // Count pending and completed actions (with safety check for legacy data)
      const actionsData = progress.actionsCompletedData || { completed: false, details: [] };
      const details = Array.isArray(actionsData.details) ? actionsData.details : [];
      const pendingActions = details.filter(a => !a.completed).length;
      const completedActions = details.filter(a => a.completed).length;
      
      res.json({
        ...progress,
        currentDay,
        lastDayOfMonth,
        nextDay: nextDay <= lastDayOfMonth ? nextDay : 1, // After month ends, next is day 1
        currentTemplate: currentTemplate ? {
          id: currentTemplate.id,
          title: currentTemplate.title,
          emailType: currentTemplate.emailType,
          dayOfMonth: currentTemplate.dayOfMonth,
          description: currentTemplate.description,
        } : null,
        nextTemplate: nextTemplate ? {
          id: nextTemplate.id,
          title: nextTemplate.title,
          emailType: nextTemplate.emailType,
          dayOfMonth: nextTemplate.dayOfMonth,
          description: nextTemplate.description,
        } : null,
        nextEmailDate,
        emailFrequencyDays,
        actionsSummary: {
          total: actionsData.details.length,
          pending: pendingActions,
          completed: completedActions,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // GET /api/email-journey-progress - Progresso tutti i clienti del consultant
  app.get("/api/email-journey-progress", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const allProgress = await storage.getAllClientEmailJourneyProgress(req.user!.id);
      
      // Get SMTP settings once for all clients
      const smtpSettings = await storage.getConsultantSmtpSettings(req.user!.id);
      const emailFrequencyDays = smtpSettings?.emailFrequencyDays || 2;
      
      // Enrich with client data, template info, and calculations
      const progressWithEnrichedData = await Promise.all(
        allProgress.map(async (progress) => {
          const client = await storage.getUser(progress.clientId);
          
          // Calculate current day using calendar date
          const now = new Date();
          const currentDay = now.getDate(); // Get day of month (1-31) from current date
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          
          // Get current template using dynamic selection
          const templateDay = calculateTemplateDay(currentDay, lastDayOfMonth);
          const currentTemplate = await storage.getEmailJourneyTemplate(templateDay);
          
          // Get next template (for "what's coming next" preview)
          let nextDay = currentDay + 1;
          let nextTemplate = null;
          
          // Check if we're at end of month
          if (nextDay > lastDayOfMonth) {
            // Month ended - next template is day 1 of new cycle
            nextDay = 1;
            nextTemplate = await storage.getEmailJourneyTemplate(1);
          } else {
            // Next day is still within current month
            const nextTemplateDay = calculateTemplateDay(nextDay, lastDayOfMonth);
            nextTemplate = await storage.getEmailJourneyTemplate(nextTemplateDay);
          }
          
          // Calculate next email date
          let nextEmailDate = null;
          if (progress.lastEmailSentAt) {
            const lastSent = new Date(progress.lastEmailSentAt);
            nextEmailDate = new Date(lastSent.getTime() + emailFrequencyDays * 24 * 60 * 60 * 1000);
          }
          
          // Count pending and completed actions (with safety check for legacy data)
          const actionsData = progress.actionsCompletedData || { completed: false, details: [] };
          const details = Array.isArray(actionsData.details) ? actionsData.details : [];
          const pendingActions = details.filter(a => !a.completed).length;
          const completedActions = details.filter(a => a.completed).length;
          
          return {
            ...progress,
            currentDay,
            lastDayOfMonth,
            nextDay: nextDay <= lastDayOfMonth ? nextDay : null,
            currentTemplate: currentTemplate ? {
              id: currentTemplate.id,
              title: currentTemplate.title,
              emailType: currentTemplate.emailType,
              dayOfMonth: currentTemplate.dayOfMonth,
              description: currentTemplate.description,
            } : null,
            nextTemplate: nextTemplate ? {
              id: nextTemplate.id,
              title: nextTemplate.title,
              emailType: nextTemplate.emailType,
              dayOfMonth: nextTemplate.dayOfMonth,
              description: nextTemplate.description,
            } : null,
            nextEmailDate,
            emailFrequencyDays,
            actionsSummary: {
              total: actionsData.details.length,
              pending: pendingActions,
              completed: completedActions,
            },
            client: client ? {
              id: client.id,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              avatar: client.avatar,
            } : null,
          };
        })
      );
      
      res.json(progressWithEnrichedData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Vertex AI Settings endpoints
  app.get('/api/vertex-ai/settings', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      
      const [settings] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(eq(schema.vertexAiSettings.userId, userId))
        .limit(1);
      
      if (!settings) {
        return res.json({ settings: null });
      }
      
      // Calculate days remaining
      const now = new Date();
      const daysRemaining = Math.ceil((settings.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Return settings without sensitive serviceAccountJson
      res.json({
        settings: {
          id: settings.id,
          projectId: settings.projectId,
          location: settings.location,
          enabled: settings.enabled,
          managedBy: settings.managedBy,
          activatedAt: settings.activatedAt,
          expiresAt: settings.expiresAt,
          daysRemaining,
          lastUsedAt: settings.lastUsedAt,
          usageCount: settings.usageCount,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/vertex-ai/settings', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { projectId, location, serviceAccountJson, usageScope } = req.body;
      
      // Validation
      if (!projectId || !location || !serviceAccountJson) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Validate location
      const validLocations = ['us-central1', 'us-east1', 'europe-west1', 'europe-west4', 'asia-southeast1'];
      if (!validLocations.includes(location)) {
        return res.status(400).json({ message: "Invalid location" });
      }
      
      // Validate usageScope
      const validUsageScopes = ['both', 'consultant_only', 'clients_only', 'selective'];
      const finalUsageScope = usageScope && validUsageScopes.includes(usageScope) ? usageScope : 'both';

      
      // Validate service account JSON
      let parsedServiceAccount;
      try {
        parsedServiceAccount = JSON.parse(serviceAccountJson);
        if (!parsedServiceAccount.private_key || !parsedServiceAccount.client_email || !parsedServiceAccount.project_id) {
          return res.status(400).json({ message: "Invalid service account JSON structure" });
        }
      } catch (error) {
        return res.status(400).json({ message: "Invalid JSON format" });
      }
      
      // Store service account JSON as plain text (no encryption)
      const jsonString = JSON.stringify(parsedServiceAccount);
      
      // Calculate expiration date (90 days from now)
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setDate(expiresAt.getDate() + 90);
      
      // Check if settings already exist
      const [existing] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(eq(schema.vertexAiSettings.userId, userId))
        .limit(1);
      
      if (existing) {
        // Parse old credentials to check if they've actually changed
        let shouldResetDates = false;
        try {
          const oldCreds = JSON.parse(existing.serviceAccountJson);
          const newCreds = parsedServiceAccount;
          // If project_id changed, it's a completely new setup - reset dates
          if (oldCreds.project_id !== newCreds.project_id) {
            shouldResetDates = true;
          }
        } catch (error) {
          // If parsing fails, assume new setup
          shouldResetDates = true;
        }

        // Update existing - preserve enabled, activatedAt, expiresAt unless new project
        const [updated] = await db
          .update(schema.vertexAiSettings)
          .set({
            projectId,
            location,
            serviceAccountJson: jsonString,
            usageScope: finalUsageScope,
            // Preserve these unless it's a new project:
            ...(shouldResetDates ? {
              activatedAt,
              expiresAt,
            } : {}),
            // Always preserve enabled state
            enabled: existing.enabled,
            // Always preserve managedBy
            managedBy: existing.managedBy,
            updatedAt: new Date(),
          })
          .where(eq(schema.vertexAiSettings.id, existing.id))
          .returning();
        
        res.json({ message: "Settings updated", id: updated.id });
      } else {
        // Create new
        const [created] = await db
          .insert(schema.vertexAiSettings)
          .values({
            userId,
            projectId,
            location,
            serviceAccountJson: jsonString,
            enabled: true,
            managedBy: 'self',
            usageScope: finalUsageScope,
            activatedAt,
            expiresAt,
          })
          .returning();
        
        res.json({ message: "Settings created", id: created.id });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/vertex-ai/settings/:id/toggle', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Verify ownership
      const [settings] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(and(
          eq(schema.vertexAiSettings.id, id),
          eq(schema.vertexAiSettings.userId, userId)
        ))
        .limit(1);
      
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      // Toggle enabled
      const [updated] = await db
        .update(schema.vertexAiSettings)
        .set({
          enabled: !settings.enabled,
          updatedAt: new Date(),
        })
        .where(eq(schema.vertexAiSettings.id, id))
        .returning();
      
      res.json({ message: "Settings toggled", enabled: updated.enabled });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/vertex-ai/settings/:id', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      
      // Verify ownership
      const [settings] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(and(
          eq(schema.vertexAiSettings.id, id),
          eq(schema.vertexAiSettings.userId, userId)
        ))
        .limit(1);
      
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      
      await db
        .delete(schema.vertexAiSettings)
        .where(eq(schema.vertexAiSettings.id, id));
      
      res.json({ message: "Settings deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get active AI provider info
  app.get('/api/ai/active-provider', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const now = new Date();

      // Get user's consultant ID for tier 2 check
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      const consultantId = user?.consultantId || userId;

      // Helper to check if Vertex AI is valid and not expired
      const isValidAndNotExpired = (settings: any): boolean => {
        if (!settings.enabled) return false;
        const expirationDate = settings.expiresAt ? new Date(settings.expiresAt) : 
          new Date(new Date(settings.activatedAt).getTime() + 90 * 24 * 60 * 60 * 1000);
        return expirationDate > now;
      };

      // TIER 1: Check client Vertex AI (self-managed)
      const [clientSettings] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(eq(schema.vertexAiSettings.userId, userId))
        .limit(1);

      if (clientSettings && isValidAndNotExpired(clientSettings)) {
        const daysRemaining = Math.ceil((new Date(clientSettings.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return res.json({
          provider: "Vertex AI (tuo)",
          source: "client",
          expiresAt: clientSettings.expiresAt,
          isExpired: false,
          daysRemaining,
        });
      }

      // TIER 2: Check admin Vertex AI (consultant-managed)
      const [adminSettings] = await db
        .select()
        .from(schema.vertexAiSettings)
        .where(and(
          eq(schema.vertexAiSettings.userId, consultantId),
          eq(schema.vertexAiSettings.managedBy, "admin")
        ))
        .limit(1);

      if (adminSettings && isValidAndNotExpired(adminSettings)) {
        const daysRemaining = Math.ceil((new Date(adminSettings.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return res.json({
          provider: "Vertex AI (admin)",
          source: "admin",
          expiresAt: adminSettings.expiresAt,
          isExpired: false,
          daysRemaining,
        });
      }

      // TIER 3: Fallback to Google AI Studio
      const apiKeys = user?.geminiApiKeys || [];
      return res.json({
        provider: "Google AI Studio",
        source: "google",
        expiresAt: null,
        isExpired: false,
        daysRemaining: null,
        apiKeysCount: apiKeys.length,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client AI Configuration endpoints for consultants
  app.get('/api/consultant/client-ai-config', authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Get all clients for this consultant with their Vertex AI settings
      const clientsRaw = await db
        .select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          email: schema.users.email,
          preferredAiProvider: schema.users.preferredAiProvider,
          geminiApiKeys: schema.users.geminiApiKeys,
          geminiApiKeyIndex: schema.users.geminiApiKeyIndex,
          vertexProjectId: schema.vertexAiSettings.projectId,
          vertexLocation: schema.vertexAiSettings.location,
          vertexExpiresAt: schema.vertexAiSettings.expiresAt,
          vertexEnabled: schema.vertexAiSettings.enabled,
        })
        .from(schema.users)
        .leftJoin(
          schema.vertexAiSettings,
          and(
            eq(schema.vertexAiSettings.userId, schema.users.id),
            eq(schema.vertexAiSettings.managedBy, "self")
          )
        )
        .where(and(
          eq(schema.users.consultantId, consultantId),
          eq(schema.users.role, "client")
        ))
        .orderBy(schema.users.firstName, schema.users.lastName);

      // Format response with vertex settings when available (include even if disabled)
      const clients = clientsRaw.map(client => ({
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        preferredAiProvider: client.preferredAiProvider,
        geminiApiKeys: client.geminiApiKeys,
        geminiApiKeyIndex: client.geminiApiKeyIndex,
        // Return vertexSettings if projectId exists (even if disabled) so frontend knows credentials are saved
        vertexSettings: client.vertexProjectId ? {
          projectId: client.vertexProjectId,
          location: client.vertexLocation,
          expiresAt: client.vertexExpiresAt,
          enabled: client.vertexEnabled ?? false,
        } : null,
      }));

      res.json({ clients });
    } catch (error: any) {
      console.error("❌ Error fetching client AI config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/consultant/client-ai-config/:clientId', authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { clientId } = req.params;

      // Validate request body with Zod
      const validationResult = updateClientAiConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.errors 
        });
      }

      const { preferredAiProvider, geminiApiKeys, vertexProjectId, vertexLocation, vertexServiceAccountJson } = validationResult.data;

      // Verify client belongs to this consultant
      const [client] = await db
        .select()
        .from(schema.users)
        .where(and(
          eq(schema.users.id, clientId),
          eq(schema.users.consultantId, consultantId),
          eq(schema.users.role, "client")
        ))
        .limit(1);

      if (!client) {
        return res.status(404).json({ message: "Client not found or not authorized" });
      }

      // Validate geminiApiKeys if provider is custom
      if (preferredAiProvider === 'custom') {
        if (!Array.isArray(geminiApiKeys) || geminiApiKeys.length === 0 || geminiApiKeys.length > 10) {
          return res.status(400).json({ message: "Custom provider requires 1-10 API keys" });
        }
        // Filter out empty keys
        const validKeys = geminiApiKeys.filter((key: string) => key.trim() !== '');
        if (validKeys.length === 0) {
          return res.status(400).json({ message: "At least one valid API key is required for custom provider" });
        }
      }

      // Validate and encrypt Vertex AI credentials if provider is vertex_self AND credentials provided
      let encryptedServiceAccountJson: string | undefined;
      let shouldUpdateVertexCredentials = false;
      
      if (preferredAiProvider === 'vertex_self' && vertexServiceAccountJson) {
        // Credentials are being provided - validate everything
        if (!vertexProjectId || !vertexLocation) {
          return res.status(400).json({ message: "Vertex AI self provider requires projectId and location when updating credentials" });
        }

        // Validate location
        const validLocations = ['us-central1', 'us-east1', 'europe-west1', 'europe-west4', 'asia-southeast1'];
        if (!validLocations.includes(vertexLocation)) {
          return res.status(400).json({ message: "Invalid Vertex AI location" });
        }

        // Validate and parse service account JSON
        let parsedServiceAccount;
        try {
          parsedServiceAccount = JSON.parse(vertexServiceAccountJson);
          if (!parsedServiceAccount.private_key || !parsedServiceAccount.client_email || !parsedServiceAccount.project_id) {
            return res.status(400).json({ message: "Invalid service account JSON structure (missing private_key, client_email, or project_id)" });
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid JSON format for service account" });
        }

        // Encrypt service account JSON before storing
        encryptedServiceAccountJson = encryptJSON(parsedServiceAccount);
        shouldUpdateVertexCredentials = true;
      } else if (preferredAiProvider === 'vertex_self' && !vertexServiceAccountJson) {
        // Switching to vertex_self but no credentials provided - check if they already exist
        const [existingSettings] = await db
          .select()
          .from(schema.vertexAiSettings)
          .where(and(
            eq(schema.vertexAiSettings.userId, clientId),
            eq(schema.vertexAiSettings.managedBy, "self")
          ))
          .limit(1);

        if (!existingSettings || !existingSettings.enabled) {
          return res.status(400).json({ message: "Vertex AI self provider requires credentials. Please provide projectId, location, and serviceAccountJson" });
        }
        // Existing credentials found, we'll just switch the provider without touching them
      }

      // Update client configuration
      const updateData: any = {
        preferredAiProvider,
      };

      if (preferredAiProvider === 'custom') {
        // Custom: use provided API keys
        updateData.geminiApiKeys = geminiApiKeys.filter((key: string) => key.trim() !== '');
        updateData.geminiApiKeyIndex = 0; // Reset rotation index
      } else {
        // vertex_admin, google_studio, or vertex_self: clear client keys to prevent client-tier usage
        updateData.geminiApiKeys = [];
        updateData.geminiApiKeyIndex = 0;
      }

      // If vertex_self and credentials provided, create/update Vertex AI settings for this client
      if (preferredAiProvider === 'vertex_self' && shouldUpdateVertexCredentials) {
        // Check if client already has Vertex AI settings
        const [existingVertexSettings] = await db
          .select()
          .from(schema.vertexAiSettings)
          .where(and(
            eq(schema.vertexAiSettings.userId, clientId),
            eq(schema.vertexAiSettings.managedBy, "self")
          ))
          .limit(1);

        // Calculate expiration date (90 days from now)
        const activatedAt = new Date();
        const expiresAt = new Date(activatedAt);
        expiresAt.setDate(expiresAt.getDate() + 90);

        const vertexData = {
          userId: clientId,
          projectId: vertexProjectId!,
          location: vertexLocation!,
          serviceAccountJson: encryptedServiceAccountJson!,
          managedBy: "self" as const,
          enabled: true,
          activatedAt,
          expiresAt,
        };

        if (existingVertexSettings) {
          // Update existing
          await db
            .update(schema.vertexAiSettings)
            .set(vertexData)
            .where(eq(schema.vertexAiSettings.id, existingVertexSettings.id));
        } else {
          // Create new
          await db.insert(schema.vertexAiSettings).values(vertexData);
        }
      } else if (preferredAiProvider === 'vertex_self') {
        // Just switching to vertex_self, ensure existing settings are enabled
        await db
          .update(schema.vertexAiSettings)
          .set({ enabled: true })
          .where(and(
            eq(schema.vertexAiSettings.userId, clientId),
            eq(schema.vertexAiSettings.managedBy, "self")
          ));
      } else {
        // If switching away from vertex_self, disable client's Vertex AI settings
        await db
          .update(schema.vertexAiSettings)
          .set({ enabled: false })
          .where(and(
            eq(schema.vertexAiSettings.userId, clientId),
            eq(schema.vertexAiSettings.managedBy, "self")
          ));
      }

      const [updated] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, clientId))
        .returning({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          preferredAiProvider: schema.users.preferredAiProvider,
          geminiApiKeys: schema.users.geminiApiKeys,
        });

      res.json({ 
        message: "Client AI configuration updated successfully",
        client: updated
      });
    } catch (error: any) {
      console.error("❌ Error updating client AI config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TURN Server Configuration - Per WebRTC Video Calls
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/consultant/turn-config - Retrieve TURN configuration (from SuperAdmin only)
  app.get("/api/consultant/turn-config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      // Now consultants inherit TURN config from SuperAdmin only - no personal config allowed
      const [adminConfig] = await db
        .select()
        .from(schema.adminTurnConfig)
        .limit(1);

      if (!adminConfig || !adminConfig.usernameEncrypted || !adminConfig.passwordEncrypted) {
        return res.json({
          configured: false,
          config: null,
          source: "admin",
          message: "Il SuperAdmin non ha ancora configurato il server TURN. Contatta l'amministratore."
        });
      }

      // Decrypt admin credentials
      let username = "";
      try {
        username = decrypt(adminConfig.usernameEncrypted);
      } catch (decryptError) {
        console.error("❌ Error decrypting admin TURN username:", decryptError);
      }

      res.json({
        configured: true,
        source: "admin",
        config: {
          id: adminConfig.id,
          provider: adminConfig.provider,
          username,
          password: "••••••••", // Always mask password
          turnUrls: adminConfig.turnUrls,
          enabled: adminConfig.enabled,
          createdAt: adminConfig.createdAt,
          updatedAt: adminConfig.updatedAt
        }
      });
    } catch (error: any) {
      console.error("❌ Error fetching TURN config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/consultant/turn-config - Save TURN configuration
  app.post("/api/consultant/turn-config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { provider, username, password, turnUrls, enabled } = req.body;

      // Validate required fields
      if (!username || !password) {
        return res.status(400).json({ message: "Username e password sono obbligatori" });
      }

      // Get or create consultant encryption salt
      let [consultant] = await db
        .select({ encryptionSalt: schema.users.encryptionSalt })
        .from(schema.users)
        .where(eq(schema.users.id, consultantId))
        .limit(1);

      let encryptionSalt = consultant?.encryptionSalt;
      
      // If no salt exists, generate one
      if (!encryptionSalt) {
        const { generateEncryptionSalt } = await import("./encryption");
        encryptionSalt = generateEncryptionSalt();
        await db
          .update(schema.users)
          .set({ encryptionSalt })
          .where(eq(schema.users.id, consultantId));
      }

      // Encrypt credentials
      const usernameEncrypted = encryptForConsultant(username, encryptionSalt);
      const passwordEncrypted = encryptForConsultant(password, encryptionSalt);

      // Check if config already exists
      const [existingConfig] = await db
        .select()
        .from(schema.consultantTurnConfig)
        .where(eq(schema.consultantTurnConfig.consultantId, consultantId))
        .limit(1);

      if (existingConfig) {
        // Update existing config
        const [updated] = await db
          .update(schema.consultantTurnConfig)
          .set({
            provider: provider || "metered",
            usernameEncrypted,
            passwordEncrypted,
            turnUrls: turnUrls || null,
            enabled: enabled !== false,
            updatedAt: new Date()
          })
          .where(eq(schema.consultantTurnConfig.id, existingConfig.id))
          .returning();

        return res.json({
          message: "Configurazione TURN aggiornata con successo",
          config: {
            id: updated.id,
            provider: updated.provider,
            enabled: updated.enabled
          }
        });
      }

      // Create new config
      const [newConfig] = await db
        .insert(schema.consultantTurnConfig)
        .values({
          consultantId,
          provider: provider || "metered",
          usernameEncrypted,
          passwordEncrypted,
          turnUrls: turnUrls || null,
          enabled: enabled !== false
        })
        .returning();

      res.json({
        message: "Configurazione TURN salvata con successo",
        config: {
          id: newConfig.id,
          provider: newConfig.provider,
          enabled: newConfig.enabled
        }
      });
    } catch (error: any) {
      console.error("❌ Error saving TURN config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/video-meeting/ice-servers - Get ICE servers for WebRTC (public for meeting participants)
  // Uses cascade service: consultant config -> admin config fallback
  app.get("/api/video-meeting/ice-servers/:meetingIdOrToken", async (req, res) => {
    try {
      const { meetingIdOrToken } = req.params;

      // Try to find meeting by ID first, then by token (supports both)
      let meeting = await db
        .select({ 
          sellerId: schema.videoMeetings.sellerId 
        })
        .from(schema.videoMeetings)
        .where(eq(schema.videoMeetings.id, meetingIdOrToken))
        .limit(1)
        .then(rows => rows[0]);
      
      if (!meeting) {
        // Try by meetingToken
        meeting = await db
          .select({ 
            sellerId: schema.videoMeetings.sellerId 
          })
          .from(schema.videoMeetings)
          .where(eq(schema.videoMeetings.meetingToken, meetingIdOrToken))
          .limit(1)
          .then(rows => rows[0]);
      }

      // Use the cascade service to get TURN credentials
      // Falls back to admin config if consultant config not found
      const credentials = await getTurnCredentialsForMeeting(meeting?.sellerId || null);

      if (!credentials) {
        // Return default STUN servers if no TURN config available
        console.log(`⚠️ [ICE] No TURN config available, returning STUN only`);
        return res.json({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
      }

      console.log(`✅ [ICE] Using TURN config from ${credentials.source}`);

      // Build ICE servers array with STUN + TURN
      const iceServers: RTCIceServer[] = [
        { urls: 'stun:stun.relay.metered.ca:80' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      const { username, password, provider, turnUrls } = credentials;

      // Add TURN servers based on provider
      if (provider === "metered") {
        iceServers.push(
          // Standard relay servers (piano 20GB+)
          {
            urls: "turn:standard.relay.metered.ca:80",
            username,
            credential: password
          },
          {
            urls: "turn:standard.relay.metered.ca:80?transport=tcp",
            username,
            credential: password
          },
          {
            urls: "turn:standard.relay.metered.ca:443",
            username,
            credential: password
          },
          {
            urls: "turns:standard.relay.metered.ca:443?transport=tcp",
            username,
            credential: password
          },
          // Global relay servers (piano base 500MB - fallback)
          {
            urls: "turn:global.relay.metered.ca:80",
            username,
            credential: password
          },
          {
            urls: "turn:global.relay.metered.ca:80?transport=tcp",
            username,
            credential: password
          },
          {
            urls: "turn:global.relay.metered.ca:443",
            username,
            credential: password
          },
          {
            urls: "turns:global.relay.metered.ca:443?transport=tcp",
            username,
            credential: password
          }
        );
      } else if (provider === "custom" && turnUrls) {
        // Custom TURN URLs
        for (const url of turnUrls) {
          iceServers.push({
            urls: url,
            username,
            credential: password
          });
        }
      }

      res.json({ iceServers });
    } catch (error: any) {
      console.error("❌ Error fetching ICE servers:", error);
      // Return default STUN servers on error
      res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
    }
  });

  // Force leave endpoint for cleanup via sendBeacon on page reload
  app.post("/api/video-meeting/force-leave", async (req, res) => {
    try {
      const { participantId, meetingId, meetingToken } = req.body;
      
      if (!participantId || !meetingId || !meetingToken) {
        console.warn(`⚠️ [ForceLeave] Missing required fields: participantId=${!!participantId}, meetingId=${!!meetingId}, meetingToken=${!!meetingToken}`);
        return res.status(400).json({ error: 'Missing participantId, meetingId, or meetingToken' });
      }
      
      // Verify meeting token matches the meeting
      const [meeting] = await db.select()
        .from(schema.videoMeetings)
        .where(and(
          eq(schema.videoMeetings.id, meetingId),
          eq(schema.videoMeetings.meetingToken, meetingToken)
        ))
        .limit(1);
      
      if (!meeting) {
        console.warn(`⚠️ [ForceLeave] Invalid meeting token for meeting ${meetingId}`);
        return res.status(403).json({ error: 'Invalid meeting token' });
      }
      
      // Verify participant belongs to this meeting
      const [participant] = await db.select()
        .from(schema.videoMeetingParticipants)
        .where(and(
          eq(schema.videoMeetingParticipants.id, participantId),
          eq(schema.videoMeetingParticipants.meetingId, meetingId)
        ))
        .limit(1);
      
      if (!participant) {
        console.warn(`⚠️ [ForceLeave] Participant ${participantId} not found in meeting ${meetingId}`);
        return res.status(404).json({ error: 'Participant not found' });
      }
      
      console.log(`🔥 [ForceLeave] Received force-leave request for participant ${participantId} (${participant.name}) in meeting ${meetingId}`);
      
      // Mark participant as left in database
      await db.update(schema.videoMeetingParticipants)
        .set({ leftAt: new Date() })
        .where(eq(schema.videoMeetingParticipants.id, participantId));
      
      console.log(`✅ [ForceLeave] Marked participant ${participantId} as left in database`);
      
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("❌ [ForceLeave] Error:", error.message);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  });

  // Twilio Centralized Settings Endpoints (stored in users table)
  app.get("/api/consultant/twilio-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const showDebug = req.query.debug === "true";

      const [user] = await db
        .select({
          twilioAccountSid: schema.users.twilioAccountSid,
          twilioAuthToken: schema.users.twilioAuthToken,
          twilioWhatsappNumber: schema.users.twilioWhatsappNumber,
          encryptionSalt: schema.users.encryptionSalt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, consultantId))
        .limit(1);

      if (!user || !user.twilioAccountSid) {
        return res.status(404).json({ success: false, message: "Twilio settings not configured" });
      }
      
      // Debug mode: show token length ONLY (never expose actual token for security)
      let debugInfo: any = undefined;
      if (showDebug && user.twilioAuthToken && user.encryptionSalt) {
        try {
          const decryptedToken = decryptForConsultant(user.twilioAuthToken, user.encryptionSalt);
          debugInfo = {
            encryptedTokenLength: user.twilioAuthToken.length,
            decryptedTokenLength: decryptedToken.length,
            canDecrypt: true,
            // SECURITY: Never expose actual token value
          };
          console.log("🔓 [Twilio Settings DEBUG] Token can be decrypted - length:", decryptedToken.length);
        } catch (e: any) {
          debugInfo = {
            error: "Failed to decrypt: " + e.message,
            encryptedTokenLength: user.twilioAuthToken?.length || 0,
            canDecrypt: false,
          };
        }
      }

      res.json({
        success: true,
        settings: {
          accountSid: user.twilioAccountSid,
          whatsappNumber: user.twilioWhatsappNumber || "",
          hasAuthToken: !!user.twilioAuthToken,
          authTokenLength: user.twilioAuthToken?.length || 0,
        },
        debug: debugInfo,
      });
    } catch (error: any) {
      console.error("❌ Error fetching Twilio settings:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/consultant/twilio-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { accountSid, authToken, whatsappNumber } = req.body;
      
      console.log("📥 [Twilio Settings] Received save request:", {
        consultantId,
        accountSidLength: accountSid?.length || 0,
        authTokenLength: authToken?.length || 0,
        hasAuthToken: !!authToken,
        whatsappNumber: whatsappNumber || "N/A",
      });

      if (!accountSid) {
        return res.status(400).json({ success: false, message: "Account SID è obbligatorio" });
      }
      
      // CRITICAL: Also require auth token when saving Twilio settings
      if (!authToken || authToken.trim() === "") {
        console.log("❌ [Twilio Settings] Auth Token is required but was empty/null");
        return res.status(400).json({ success: false, message: "Auth Token è obbligatorio" });
      }

      // Get or create consultant's encryption salt
      const [consultant] = await db
        .select({ encryptionSalt: schema.users.encryptionSalt })
        .from(schema.users)
        .where(eq(schema.users.id, consultantId))
        .limit(1);

      let encryptionSalt = consultant?.encryptionSalt;
      
      // Auto-create encryption salt if missing
      if (!encryptionSalt) {
        console.log(`🔐 [Twilio Settings] Creating encryption salt for consultant ${consultantId}`);
        encryptionSalt = generateEncryptionSalt();
        await db
          .update(schema.users)
          .set({ encryptionSalt })
          .where(eq(schema.users.id, consultantId));
        console.log(`✅ [Twilio Settings] Encryption salt created successfully`);
      }

      const updateData: any = {
        twilioAccountSid: accountSid,
        twilioWhatsappNumber: whatsappNumber || null,
      };

      // Encrypt the auth token for storage
      const encryptedToken = encryptForConsultant(authToken, encryptionSalt);
      updateData.twilioAuthToken = encryptedToken;
      console.log("🔐 [Twilio Settings] Encrypted auth token - original length:", authToken.length, "encrypted length:", encryptedToken.length);

      await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, consultantId));

      console.log(`✅ [Twilio Settings] Updated for consultant ${consultantId} - token saved successfully`);

      res.json({
        success: true,
        message: "Configurazione Twilio salvata con successo",
      });
    } catch (error: any) {
      console.error("❌ Error saving Twilio settings:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/consultant/twilio-settings/test", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { accountSid, authToken } = req.body;

      let testAccountSid = accountSid;
      let testAuthToken = authToken;

      // If authToken not provided, try to get saved credentials
      if (!testAuthToken) {
        const [user] = await db
          .select({
            twilioAccountSid: schema.users.twilioAccountSid,
            twilioAuthToken: schema.users.twilioAuthToken,
            encryptionSalt: schema.users.encryptionSalt,
          })
          .from(schema.users)
          .where(eq(schema.users.id, consultantId))
          .limit(1);

        if (!user?.twilioAuthToken) {
          return res.status(400).json({ success: false, message: "Auth Token non trovato. Inserisci un Auth Token per testare." });
        }

        if (!user?.encryptionSalt) {
          return res.status(400).json({ success: false, message: "Encryption salt non configurato. Contatta il supporto." });
        }

        // Try to decrypt using correct signature: (encryptedData, salt)
        try {
          testAuthToken = decryptForConsultant(user.twilioAuthToken, user.encryptionSalt);
        } catch (decryptError: any) {
          console.error("❌ Failed to decrypt stored auth token:", decryptError.message);
          return res.status(400).json({ 
            success: false, 
            message: "Le credenziali salvate sono corrotte. Inserisci nuovamente Account SID e Auth Token, poi salva prima di testare." 
          });
        }
        testAccountSid = testAccountSid || user.twilioAccountSid;
      }

      if (!testAccountSid || !testAuthToken) {
        return res.status(400).json({ success: false, message: "Account SID e Auth Token sono obbligatori" });
      }

      // Test Twilio connection by fetching account info
      const twilioClient = twilio(testAccountSid, testAuthToken);
      const account = await twilioClient.api.v2010.accounts(testAccountSid).fetch();

      res.json({
        success: true,
        message: `Connessione riuscita! Account: ${account.friendlyName}`,
        accountName: account.friendlyName,
        accountStatus: account.status,
      });
    } catch (error: any) {
      console.error("❌ Twilio test connection failed:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Connessione fallita. Verifica le credenziali.",
      });
    }
  });

  // WhatsApp configuration endpoints for consultants
  app.get("/api/whatsapp/config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const configs = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId))
        .orderBy(schema.consultantWhatsappConfig.createdAt);

      if (configs.length === 0) {
        return res.json({
          configured: false,
          configs: [],
        });
      }

      // Return configs without sensitive credentials (exclude only twilioAuthToken)
      res.json({
        configured: true,
        configs: configs.map(config => ({
          id: config.id,
          agentName: config.agentName,
          twilioAccountSid: config.twilioAccountSid,
          twilioWhatsappNumber: config.twilioWhatsappNumber,
          autoResponseEnabled: config.autoResponseEnabled,
          isActive: config.isActive,
          agentType: config.agentType,
          isProactiveAgent: config.isProactiveAgent,
          workingHoursEnabled: config.workingHoursEnabled,
          workingHoursStart: config.workingHoursStart,
          workingHoursEnd: config.workingHoursEnd,
          workingDays: config.workingDays,
          afterHoursMessage: config.afterHoursMessage,
          businessName: config.businessName,
          consultantDisplayName: config.consultantDisplayName,
          businessDescription: config.businessDescription,
          consultantBio: config.consultantBio,
          salesScript: config.salesScript,
          vision: config.vision,
          mission: config.mission,
          values: config.values,
          usp: config.usp,
          whoWeHelp: config.whoWeHelp,
          whoWeDontHelp: config.whoWeDontHelp,
          whatWeDo: config.whatWeDo,
          howWeDoIt: config.howWeDoIt,
          softwareCreated: config.softwareCreated,
          booksPublished: config.booksPublished,
          yearsExperience: config.yearsExperience,
          clientsHelped: config.clientsHelped,
          resultsGenerated: config.resultsGenerated,
          caseStudies: config.caseStudies,
          servicesOffered: config.servicesOffered,
          guarantees: config.guarantees,
          aiPersonality: config.aiPersonality,
          whatsappConciseMode: config.whatsappConciseMode,
          defaultObiettivi: config.defaultObiettivi,
          defaultDesideri: config.defaultDesideri,
          defaultUncino: config.defaultUncino,
          defaultIdealState: config.defaultIdealState,
          isDryRun: config.isDryRun,
          whatsappTemplates: config.whatsappTemplates,
          // Feature Blocks Configuration
          bookingEnabled: config.bookingEnabled,
          objectionHandlingEnabled: config.objectionHandlingEnabled,
          disqualificationEnabled: config.disqualificationEnabled,
          upsellingEnabled: config.upsellingEnabled,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        })),
      });
    } catch (error: any) {
      console.error("❌ Error fetching WhatsApp config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get proactive WhatsApp agents (isProactiveAgent=true OR agentType=proactive_setter) with Twilio configured
  app.get("/api/whatsapp/config/proactive", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const configs = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.consultantId, consultantId),
            eq(schema.consultantWhatsappConfig.isActive, true),
            sql`(${schema.consultantWhatsappConfig.isProactiveAgent} = true OR ${schema.consultantWhatsappConfig.agentType} = 'proactive_setter')`,
            sql`${schema.consultantWhatsappConfig.twilioAccountSid} IS NOT NULL AND ${schema.consultantWhatsappConfig.twilioAccountSid} != ''`,
            sql`${schema.consultantWhatsappConfig.twilioAuthToken} IS NOT NULL AND ${schema.consultantWhatsappConfig.twilioAuthToken} != ''`,
            sql`${schema.consultantWhatsappConfig.twilioWhatsappNumber} IS NOT NULL AND ${schema.consultantWhatsappConfig.twilioWhatsappNumber} != ''`
          )
        )
        .orderBy(schema.consultantWhatsappConfig.createdAt);

      res.json({
        success: true,
        configs: configs.map((config) => ({
          id: config.id,
          agentName: config.agentName,
          twilioWhatsappNumber: config.twilioWhatsappNumber,
          agentType: config.agentType,
          isProactiveAgent: config.isProactiveAgent,
          isDryRun: config.isDryRun,
          integrationMode: config.integrationMode,
        })),
        count: configs.length,
      });
    } catch (error: any) {
      console.error("❌ Error fetching proactive WhatsApp agents:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get single WhatsApp config by agentId
  app.get("/api/whatsapp/config/:agentId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentId } = req.params;

      const [config] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: "Agent configuration not found or access denied",
        });
      }

      // Return config without sensitive credentials (exclude twilioAuthToken)
      res.json({
        success: true,
        data: {
          id: config.id,
          agentName: config.agentName,
          twilioAccountSid: config.twilioAccountSid,
          twilioWhatsappNumber: config.twilioWhatsappNumber,
          autoResponseEnabled: config.autoResponseEnabled,
          isActive: config.isActive,
          agentType: config.agentType,
          workingHoursEnabled: config.workingHoursEnabled,
          workingHoursStart: config.workingHoursStart,
          workingHoursEnd: config.workingHoursEnd,
          workingDays: config.workingDays,
          afterHoursMessage: config.afterHoursMessage,
          businessName: config.businessName,
          consultantDisplayName: config.consultantDisplayName,
          businessDescription: config.businessDescription,
          consultantBio: config.consultantBio,
          salesScript: config.salesScript,
          vision: config.vision,
          mission: config.mission,
          values: config.values,
          usp: config.usp,
          whoWeHelp: config.whoWeHelp,
          whoWeDontHelp: config.whoWeDontHelp,
          whatWeDo: config.whatWeDo,
          howWeDoIt: config.howWeDoIt,
          softwareCreated: config.softwareCreated,
          booksPublished: config.booksPublished,
          yearsExperience: config.yearsExperience,
          clientsHelped: config.clientsHelped,
          resultsGenerated: config.resultsGenerated,
          caseStudies: config.caseStudies,
          servicesOffered: config.servicesOffered,
          guarantees: config.guarantees,
          aiPersonality: config.aiPersonality,
          whatsappConciseMode: config.whatsappConciseMode,
          defaultObiettivi: config.defaultObiettivi,
          defaultDesideri: config.defaultDesideri,
          defaultUncino: config.defaultUncino,
          defaultIdealState: config.defaultIdealState,
          isDryRun: config.isDryRun,
          whatsappTemplates: config.whatsappTemplates,
          // Feature Blocks Configuration
          bookingEnabled: config.bookingEnabled,
          objectionHandlingEnabled: config.objectionHandlingEnabled,
          disqualificationEnabled: config.disqualificationEnabled,
          upsellingEnabled: config.upsellingEnabled,
          // TTS/Audio Configuration
          ttsEnabled: config.ttsEnabled,
          audioResponseMode: config.audioResponseMode,
          // Agent Instructions Configuration
          agentInstructions: config.agentInstructions,
          agentInstructionsEnabled: config.agentInstructionsEnabled,
          selectedTemplate: config.selectedTemplate,
          businessHeaderMode: config.businessHeaderMode,
          professionalRole: config.professionalRole,
          customBusinessHeader: config.customBusinessHeader,
          // Integration Mode and Proactive Agent
          integrationMode: config.integrationMode,
          isProactiveAgent: config.isProactiveAgent,
          // Agent-specific Google Calendar Integration
          googleCalendarId: config.googleCalendarId,
          googleCalendarEmail: config.googleCalendarEmail,
          calendarConnectedAt: config.calendarConnectedAt,
          // Agent-specific Availability Settings
          availabilityTimezone: config.availabilityTimezone,
          availabilityAppointmentDuration: config.availabilityAppointmentDuration,
          availabilityBufferBefore: config.availabilityBufferBefore,
          availabilityBufferAfter: config.availabilityBufferAfter,
          availabilityMaxDaysAhead: config.availabilityMaxDaysAhead,
          availabilityMinHoursNotice: config.availabilityMinHoursNotice,
          availabilityWorkingHours: config.availabilityWorkingHours,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error fetching WhatsApp config by ID:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Update WhatsApp config by agentId (PUT method)
  app.put("/api/whatsapp/config/:agentId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentId } = req.params;
      const { 
        agentName,
        twilioAccountSid, 
        twilioAuthToken, 
        twilioWhatsappNumber, 
        autoResponseEnabled,
        agentType,
        workingHoursEnabled,
        workingHoursStart,
        workingHoursEnd,
        workingDays,
        afterHoursMessage,
        businessName,
        consultantDisplayName,
        businessDescription,
        consultantBio,
        vision,
        mission,
        values,
        usp,
        whoWeHelp,
        whoWeDontHelp,
        whatWeDo,
        howWeDoIt,
        yearsExperience,
        clientsHelped,
        aiPersonality,
        whatsappConciseMode,
        defaultObiettivi,
        defaultDesideri,
        defaultUncino,
        defaultIdealState,
        isDryRun,
        bookingEnabled,
        objectionHandlingEnabled,
        disqualificationEnabled,
        upsellingEnabled,
        ttsEnabled,
        audioResponseMode,
        agentInstructions,
        agentInstructionsEnabled,
        selectedTemplate,
        businessHeaderMode,
        professionalRole,
        customBusinessHeader,
        integrationMode,
        isProactiveAgent,
        isActive,
        // Agent-specific Availability Settings
        availabilityTimezone,
        availabilityAppointmentDuration,
        availabilityBufferBefore,
        availabilityBufferAfter,
        availabilityMaxDaysAhead,
        availabilityMinHoursNotice,
        availabilityWorkingHours
      } = req.body;

      // Verify agent belongs to consultant
      const [existingConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);
        
      if (!existingConfig) {
        return res.status(404).json({ 
          success: false,
          message: "Configuration not found or access denied" 
        });
      }

      // If agent is being deactivated, cleanup FileSearch documents
      if (existingConfig.isActive && isActive === false) {
        try {
          const fileSearchServiceInstance = new FileSearchService();
          // Get all knowledge items for this agent
          const agentKnowledgeItems = await db.query.whatsappAgentKnowledgeItems.findMany({
            where: eq(schema.whatsappAgentKnowledgeItems.agentConfigId, agentId),
          });
          const itemIds = agentKnowledgeItems.map(item => item.id);
          
          // Get consultant's store
          const [store] = await db
            .select()
            .from(schema.fileSearchStores)
            .where(and(
              eq(schema.fileSearchStores.ownerId, consultantId),
              eq(schema.fileSearchStores.ownerType, 'consultant'),
              eq(schema.fileSearchStores.isActive, true)
            ))
            .limit(1);
          
          if (store && itemIds.length > 0) {
            console.log(`🧹 [WhatsApp] Agent deactivated, cleaning up ${itemIds.length} FileSearch documents...`);
            
            // Delete each item's FileSearch document
            for (const itemId of itemIds) {
              const [doc] = await db
                .select()
                .from(schema.fileSearchDocuments)
                .where(and(
                  eq(schema.fileSearchDocuments.storeId, store.id),
                  eq(schema.fileSearchDocuments.sourceType, 'whatsapp_agent_knowledge'),
                  eq(schema.fileSearchDocuments.sourceId, itemId)
                ))
                .limit(1);
              
              if (doc) {
                await fileSearchServiceInstance.deleteDocument(doc.id);
              }
            }
            console.log(`✅ [WhatsApp] Agent FileSearch cleanup completed`);
          }
        } catch (cleanupError) {
          console.error(`⚠️ [WhatsApp] FileSearch cleanup failed:`, cleanupError);
          // Don't fail the deactivation if cleanup fails
        }
      }

      // Build update data object
      const updateData: any = {
        updatedAt: new Date(),
      };

      // Only update provided fields
      if (agentName !== undefined) updateData.agentName = agentName;
      // Only update twilioAccountSid if it's truthy (not empty/undefined)
      if (twilioAccountSid && twilioAccountSid.trim() !== "") {
        updateData.twilioAccountSid = twilioAccountSid;
      }
      if (twilioWhatsappNumber !== undefined) updateData.twilioWhatsappNumber = twilioWhatsappNumber;
      if (autoResponseEnabled !== undefined) updateData.autoResponseEnabled = autoResponseEnabled;
      if (agentType !== undefined) updateData.agentType = agentType;
      if (workingHoursEnabled !== undefined) updateData.workingHoursEnabled = workingHoursEnabled;
      if (workingHoursStart !== undefined) updateData.workingHoursStart = workingHoursStart;
      if (workingHoursEnd !== undefined) updateData.workingHoursEnd = workingHoursEnd;
      if (workingDays !== undefined) updateData.workingDays = workingDays;
      if (afterHoursMessage !== undefined) updateData.afterHoursMessage = afterHoursMessage;
      if (businessName !== undefined) updateData.businessName = businessName;
      if (consultantDisplayName !== undefined) updateData.consultantDisplayName = consultantDisplayName;
      if (businessDescription !== undefined) updateData.businessDescription = businessDescription;
      if (consultantBio !== undefined) updateData.consultantBio = consultantBio;
      if (vision !== undefined) updateData.vision = vision;
      if (mission !== undefined) updateData.mission = mission;
      if (values !== undefined) updateData.values = values;
      if (usp !== undefined) updateData.usp = usp;
      if (whoWeHelp !== undefined) updateData.whoWeHelp = whoWeHelp;
      if (whoWeDontHelp !== undefined) updateData.whoWeDontHelp = whoWeDontHelp;
      if (whatWeDo !== undefined) updateData.whatWeDo = whatWeDo;
      if (howWeDoIt !== undefined) updateData.howWeDoIt = howWeDoIt;
      if (yearsExperience !== undefined) updateData.yearsExperience = yearsExperience;
      if (clientsHelped !== undefined) updateData.clientsHelped = clientsHelped;
      if (aiPersonality !== undefined) updateData.aiPersonality = aiPersonality;
      if (whatsappConciseMode !== undefined) updateData.whatsappConciseMode = whatsappConciseMode;
      if (defaultObiettivi !== undefined) updateData.defaultObiettivi = defaultObiettivi;
      if (defaultDesideri !== undefined) updateData.defaultDesideri = defaultDesideri;
      if (defaultUncino !== undefined) updateData.defaultUncino = defaultUncino;
      if (defaultIdealState !== undefined) updateData.defaultIdealState = defaultIdealState;
      if (isDryRun !== undefined) updateData.isDryRun = isDryRun;
      
      // Feature Blocks Configuration
      if (bookingEnabled !== undefined) updateData.bookingEnabled = bookingEnabled;
      if (objectionHandlingEnabled !== undefined) updateData.objectionHandlingEnabled = objectionHandlingEnabled;
      if (disqualificationEnabled !== undefined) updateData.disqualificationEnabled = disqualificationEnabled;
      if (upsellingEnabled !== undefined) updateData.upsellingEnabled = upsellingEnabled;
      if (ttsEnabled !== undefined) updateData.ttsEnabled = ttsEnabled;
      if (audioResponseMode !== undefined) updateData.audioResponseMode = audioResponseMode;

      // Agent Instructions Configuration
      if (agentInstructions !== undefined) updateData.agentInstructions = agentInstructions;
      if (agentInstructionsEnabled !== undefined) updateData.agentInstructionsEnabled = agentInstructionsEnabled;
      if (selectedTemplate !== undefined) updateData.selectedTemplate = selectedTemplate;
      if (businessHeaderMode !== undefined) updateData.businessHeaderMode = businessHeaderMode;
      if (professionalRole !== undefined) updateData.professionalRole = professionalRole;
      if (customBusinessHeader !== undefined) updateData.customBusinessHeader = customBusinessHeader;
      
      // Integration Mode and Proactive Agent Configuration
      if (integrationMode !== undefined) updateData.integrationMode = integrationMode;
      if (isProactiveAgent !== undefined) updateData.isProactiveAgent = isProactiveAgent;
      
      // Active Status
      if (isActive !== undefined) updateData.isActive = isActive;
      
      // Agent-specific Availability Settings
      if (availabilityTimezone !== undefined) updateData.availabilityTimezone = availabilityTimezone;
      if (availabilityAppointmentDuration !== undefined) updateData.availabilityAppointmentDuration = availabilityAppointmentDuration;
      if (availabilityBufferBefore !== undefined) updateData.availabilityBufferBefore = availabilityBufferBefore;
      if (availabilityBufferAfter !== undefined) updateData.availabilityBufferAfter = availabilityBufferAfter;
      if (availabilityMaxDaysAhead !== undefined) updateData.availabilityMaxDaysAhead = availabilityMaxDaysAhead;
      if (availabilityMinHoursNotice !== undefined) updateData.availabilityMinHoursNotice = availabilityMinHoursNotice;
      if (availabilityWorkingHours !== undefined) updateData.availabilityWorkingHours = availabilityWorkingHours;

      // Handle useCentralCredentials - copy Twilio credentials from users table
      const { useCentralCredentials } = req.body;
      
      console.log("🔑 [PUT /config] useCentralCredentials debug:", {
        useCentralCredentials,
        twilioAuthTokenProvided: !!twilioAuthToken,
        twilioAuthTokenLength: twilioAuthToken?.length || 0,
      });
      
      if (useCentralCredentials === true) {
        console.log("🔑 [PUT /config] useCentralCredentials=true, loading credentials from users table...");
        
        const [userCredentials] = await db
          .select({
            twilioAccountSid: schema.users.twilioAccountSid,
            twilioAuthToken: schema.users.twilioAuthToken,
            encryptionSalt: schema.users.encryptionSalt,
          })
          .from(schema.users)
          .where(eq(schema.users.id, consultantId))
          .limit(1);
        
        console.log("🔍 [PUT /config] Central credentials from users table:", {
          hasAccountSid: !!userCredentials?.twilioAccountSid,
          accountSidValue: userCredentials?.twilioAccountSid || "MISSING",
          hasAuthToken: !!userCredentials?.twilioAuthToken,
          authTokenLength: userCredentials?.twilioAuthToken?.length || 0,
          authTokenValue: userCredentials?.twilioAuthToken || "MISSING",
          hasEncryptionSalt: !!userCredentials?.encryptionSalt,
        });
        
        if (userCredentials?.twilioAccountSid) {
          updateData.twilioAccountSid = userCredentials.twilioAccountSid;
        }
        
        if (userCredentials?.twilioAuthToken && userCredentials?.encryptionSalt) {
          try {
            const decryptedAuthToken = decryptForConsultant(userCredentials.twilioAuthToken, userCredentials.encryptionSalt);
            updateData.twilioAuthToken = decryptedAuthToken;
            console.log("✅ [PUT /config] Decrypted and set auth token, length:", decryptedAuthToken?.length || 0);
          } catch (decryptError: any) {
            console.error("❌ [PUT /config] Failed to decrypt auth token:", decryptError.message);
          }
        }
      } else {
        // Only update twilioAuthToken if explicitly provided, not empty, and not the placeholder "configured"
        if (twilioAuthToken && twilioAuthToken.trim() !== "" && twilioAuthToken !== "configured") {
          updateData.twilioAuthToken = twilioAuthToken;
        }
      }

      console.log("🟡 [SERVER PUT /config] Dati prima del salvataggio:", JSON.stringify({
        agentInstructions: agentInstructions !== undefined ? `${agentInstructions?.length || 0} chars` : "undefined",
        agentInstructionsEnabled,
        selectedTemplate,
        businessHeaderMode,
        professionalRole,
        customBusinessHeader,
        ttsEnabled,
        audioResponseMode,
        twilioAuthTokenWillBeUpdated: !!updateData.twilioAuthToken,
        twilioAuthTokenLength: updateData.twilioAuthToken?.length || 0,
      }, null, 2));

      const [config] = await db
        .update(schema.consultantWhatsappConfig)
        .set(updateData)
        .where(eq(schema.consultantWhatsappConfig.id, agentId))
        .returning();

      console.log(`✅ [SERVER PUT /config] Updated WhatsApp config ${agentId} for consultant ${consultantId}`);
      console.log(`✅ [SERVER PUT /config] Valori salvati nel DB:`, JSON.stringify({
        selectedTemplate: config.selectedTemplate,
        agentInstructionsEnabled: config.agentInstructionsEnabled,
        instructionsLength: config.agentInstructions?.length || 0,
        businessHeaderMode: config.businessHeaderMode,
        professionalRole: config.professionalRole,
        customBusinessHeader: config.customBusinessHeader,
        ttsEnabled: config.ttsEnabled,
        audioResponseMode: config.audioResponseMode,
      }, null, 2));

      // Return success without sensitive credentials
      res.json({
        success: true,
        message: "WhatsApp configuration updated successfully",
        config: {
          id: config.id,
          agentName: config.agentName,
          twilioAccountSid: config.twilioAccountSid,
          twilioWhatsappNumber: config.twilioWhatsappNumber,
          autoResponseEnabled: config.autoResponseEnabled,
          agentType: config.agentType,
          workingHoursEnabled: config.workingHoursEnabled,
          businessName: config.businessName,
          consultantDisplayName: config.consultantDisplayName,
          isDryRun: config.isDryRun,
        },
      });
    } catch (error: any) {
      console.error("❌ Error updating WhatsApp config:", error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });

  app.post("/api/whatsapp/config/:agentId/reset-circuit-breaker", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      const consultantId = req.user!.id;
      
      const [config] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(and(
          eq(schema.consultantWhatsappConfig.id, agentId),
          eq(schema.consultantWhatsappConfig.consultantId, consultantId)
        ))
        .limit(1);
      
      if (!config) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      await db
        .update(schema.whatsappPollingWatermarks)
        .set({
          isCircuitBreakerOpen: false,
          consecutiveErrors: 0,
          circuitBreakerOpenedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappPollingWatermarks.agentConfigId, agentId));
      
      console.log(`🔓 [CIRCUIT BREAKER] Manually reset for agent ${config.agentName} (${agentId})`);
      
      res.json({ success: true, message: `Circuit breaker reset for ${config.agentName}` });
    } catch (error: any) {
      console.error("Error resetting circuit breaker:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/config", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { 
        id,
        agentName,
        twilioAccountSid, 
        twilioAuthToken, 
        twilioWhatsappNumber,
        useCentralCredentials,
        autoResponseEnabled,
        agentType,
        workingHoursEnabled,
        workingHoursStart,
        workingHoursEnd,
        workingDays,
        afterHoursMessage,
        businessName,
        consultantDisplayName,
        businessDescription,
        consultantBio,
        salesScript,
        vision,
        mission,
        values,
        usp,
        whoWeHelp,
        whoWeDontHelp,
        whatWeDo,
        howWeDoIt,
        softwareCreated,
        booksPublished,
        yearsExperience,
        clientsHelped,
        resultsGenerated,
        caseStudies,
        servicesOffered,
        guarantees,
        aiPersonality,
        whatsappConciseMode,
        defaultObiettivi,
        defaultDesideri,
        defaultUncino,
        defaultIdealState,
        isDryRun,
        bookingEnabled,
        objectionHandlingEnabled,
        disqualificationEnabled,
        upsellingEnabled,
        agentInstructions,
        agentInstructionsEnabled,
        selectedTemplate,
        businessHeaderMode,
        professionalRole,
        customBusinessHeader
      } = req.body;

      console.log("📝 [WHATSAPP CONFIG] POST request received:", {
        hasId: !!id,
        id: id || "N/A",
        agentName: agentName || "MISSING",
        hasTwilioAccountSid: !!twilioAccountSid,
        hasTwilioAuthToken: !!twilioAuthToken,
        twilioWhatsappNumber: twilioWhatsappNumber || "MISSING",
        agentType: agentType || "default"
      });

      let existingConfig = null;
      
      // Check if updating existing config by ID
      if (id) {
        [existingConfig] = await db
          .select()
          .from(schema.consultantWhatsappConfig)
          .where(
            and(
              eq(schema.consultantWhatsappConfig.id, id),
              eq(schema.consultantWhatsappConfig.consultantId, consultantId)
            )
          )
          .limit(1);
          
        if (!existingConfig) {
          console.log("❌ [WHATSAPP CONFIG] Config not found for id:", id);
          return res.status(404).json({ message: "Configuration not found" });
        }
        console.log("✅ [WHATSAPP CONFIG] Found existing config for update:", existingConfig.id);
      }

      // Get integration mode from request body
      const integrationMode = req.body.integrationMode || "whatsapp_ai";
      
      // Handle useCentralCredentials - copy credentials from users table
      let effectiveTwilioAccountSid = twilioAccountSid;
      let effectiveTwilioAuthToken = twilioAuthToken;
      
      if (useCentralCredentials) {
        console.log("🔑 [WHATSAPP CONFIG] useCentralCredentials flag detected, loading from users table...");
        
        const [userCredentials] = await db
          .select({
            twilioAccountSid: schema.users.twilioAccountSid,
            twilioAuthToken: schema.users.twilioAuthToken,
            encryptionSalt: schema.users.encryptionSalt,
          })
          .from(schema.users)
          .where(eq(schema.users.id, consultantId))
          .limit(1);
        
        console.log("🔍 [WHATSAPP CONFIG] Central credentials check:", {
          hasAccountSid: !!userCredentials?.twilioAccountSid,
          accountSidLength: userCredentials?.twilioAccountSid?.length || 0,
          hasAuthToken: !!userCredentials?.twilioAuthToken,
          authTokenLength: userCredentials?.twilioAuthToken?.length || 0,
          hasEncryptionSalt: !!userCredentials?.encryptionSalt,
        });
        
        if (!userCredentials?.twilioAccountSid || !userCredentials?.twilioAuthToken) {
          console.log("❌ [WHATSAPP CONFIG] Central Twilio credentials not found - accountSid exists:", !!userCredentials?.twilioAccountSid, "authToken exists:", !!userCredentials?.twilioAuthToken);
          return res.status(400).json({ 
            message: "Credenziali Twilio centralizzate non configurate. Vai nelle Impostazioni API per configurarle." 
          });
        }
        
        if (!userCredentials?.encryptionSalt) {
          console.log("❌ [WHATSAPP CONFIG] Encryption salt not found for user");
          return res.status(400).json({ 
            message: "Encryption salt non configurato. Contatta il supporto." 
          });
        }
        
        // Decrypt the auth token from central settings
        try {
          const decryptedAuthToken = decryptForConsultant(userCredentials.twilioAuthToken, userCredentials.encryptionSalt);
          effectiveTwilioAccountSid = userCredentials.twilioAccountSid;
          effectiveTwilioAuthToken = decryptedAuthToken;
          console.log("✅ [WHATSAPP CONFIG] Loaded central Twilio credentials successfully - decrypted token length:", decryptedAuthToken?.length || 0);
        } catch (decryptError: any) {
          console.error("❌ [WHATSAPP CONFIG] Failed to decrypt central auth token:", decryptError.message);
          return res.status(400).json({ 
            message: "Impossibile decriptare le credenziali Twilio salvate. Riconfigura le credenziali nelle Impostazioni API." 
          });
        }
      } else {
        console.log("ℹ️ [WHATSAPP CONFIG] useCentralCredentials is false/undefined - using provided credentials");
        console.log("🔍 [WHATSAPP CONFIG] Provided credentials check:", {
          hasAccountSid: !!twilioAccountSid,
          accountSidLength: twilioAccountSid?.length || 0,
          hasAuthToken: !!twilioAuthToken,
          authTokenLength: twilioAuthToken?.length || 0,
        });
      }
      
      // Validate required fields only for new configs
      if (!existingConfig) {
        // agentName is always required
        if (!agentName) {
          console.log("❌ [WHATSAPP CONFIG] Missing required field: agentName");
          return res.status(400).json({ message: "Missing required field: agentName" });
        }
        
        // Twilio credentials only required for WhatsApp integration mode
        if (integrationMode === "whatsapp_ai") {
          if (!effectiveTwilioAccountSid || !effectiveTwilioAuthToken || !twilioWhatsappNumber) {
            const missingFields = [];
            if (!effectiveTwilioAccountSid) missingFields.push("twilioAccountSid");
            if (!effectiveTwilioAuthToken) missingFields.push("twilioAuthToken");
            if (!twilioWhatsappNumber) missingFields.push("twilioWhatsappNumber");
            console.log("❌ [WHATSAPP CONFIG] Missing Twilio credentials for whatsapp_ai mode:", missingFields);
            return res.status(400).json({ message: `Missing required Twilio fields: ${missingFields.join(", ")}` });
          }
        } else {
          console.log("✅ [WHATSAPP CONFIG] ai_only mode - Twilio credentials not required");
        }
      }

      // Validate WhatsApp number format if provided
      if (twilioWhatsappNumber) {
        const phoneRegex = /^\+\d{10,15}$/;
        if (!phoneRegex.test(twilioWhatsappNumber)) {
          console.log("❌ [WHATSAPP CONFIG] Invalid WhatsApp number format:", twilioWhatsappNumber);
          return res.status(400).json({ message: "Invalid WhatsApp number format. Must start with + and contain 10-15 digits" });
        }
      }

      let config;

      if (existingConfig) {
        // Update existing config - preserve credentials if "KEEP_EXISTING"
        const updateData: any = {
          agentName: agentName || existingConfig.agentName,
          integrationMode: integrationMode,
          twilioAccountSid: effectiveTwilioAccountSid || existingConfig.twilioAccountSid,
          twilioWhatsappNumber: twilioWhatsappNumber || existingConfig.twilioWhatsappNumber,
          autoResponseEnabled: autoResponseEnabled ?? true,
          agentType: agentType || existingConfig.agentType || "reactive_lead",
          workingHoursEnabled: workingHoursEnabled ?? false,
          workingHoursStart: workingHoursStart || null,
          workingHoursEnd: workingHoursEnd || null,
          workingDays: workingDays || null,
          afterHoursMessage: afterHoursMessage || null,
          businessName: businessName || null,
          consultantDisplayName: consultantDisplayName || null,
          businessDescription: businessDescription || null,
          consultantBio: consultantBio || null,
          salesScript: salesScript || null,
          vision: vision || null,
          mission: mission || null,
          values: values || null,
          usp: usp || null,
          whoWeHelp: whoWeHelp || null,
          whoWeDontHelp: whoWeDontHelp || null,
          whatWeDo: whatWeDo || null,
          howWeDoIt: howWeDoIt || null,
          softwareCreated: softwareCreated || null,
          booksPublished: booksPublished || null,
          yearsExperience: yearsExperience || null,
          clientsHelped: clientsHelped || null,
          resultsGenerated: resultsGenerated || null,
          caseStudies: caseStudies || null,
          servicesOffered: servicesOffered || null,
          guarantees: guarantees || null,
          aiPersonality: aiPersonality || "amico_fidato",
          whatsappConciseMode: whatsappConciseMode ?? false,
          defaultObiettivi: defaultObiettivi || null,
          defaultDesideri: defaultDesideri || null,
          defaultUncino: defaultUncino || null,
          defaultIdealState: defaultIdealState || null,
          isDryRun: isDryRun ?? true,
          isActive: true,
          updatedAt: new Date(),
          // Feature Blocks Configuration
          bookingEnabled: bookingEnabled ?? true,
          objectionHandlingEnabled: objectionHandlingEnabled ?? true,
          disqualificationEnabled: disqualificationEnabled ?? true,
          upsellingEnabled: upsellingEnabled ?? false,
          // Agent Instructions Configuration
          agentInstructions: agentInstructions || existingConfig.agentInstructions || null,
          agentInstructionsEnabled: agentInstructionsEnabled ?? existingConfig.agentInstructionsEnabled ?? false,
          selectedTemplate: selectedTemplate || existingConfig.selectedTemplate || "receptionist",
          businessHeaderMode: businessHeaderMode || existingConfig.businessHeaderMode || "assistant",
          professionalRole: professionalRole || existingConfig.professionalRole || null,
          customBusinessHeader: customBusinessHeader || existingConfig.customBusinessHeader || null,
        };

        // Only update twilioAuthToken if explicitly provided and not "KEEP_EXISTING"
        // Use effective credentials if useCentralCredentials is enabled
        if (useCentralCredentials && effectiveTwilioAuthToken) {
          updateData.twilioAuthToken = effectiveTwilioAuthToken;
          console.log("🔐 [WHATSAPP CONFIG UPDATE] Using central credentials auth token - length:", effectiveTwilioAuthToken.length);
        } else if (twilioAuthToken && twilioAuthToken !== "KEEP_EXISTING") {
          updateData.twilioAuthToken = twilioAuthToken;
          console.log("🔐 [WHATSAPP CONFIG UPDATE] Using provided auth token - length:", twilioAuthToken.length);
        } else {
          console.log("ℹ️ [WHATSAPP CONFIG UPDATE] Keeping existing auth token (not updating)");
        }
        
        // Final validation before saving - ensure token is not empty for whatsapp_ai mode
        console.log("📊 [WHATSAPP CONFIG UPDATE] Pre-save data:", {
          agentName: updateData.agentName,
          twilioAccountSidLength: updateData.twilioAccountSid?.length || 0,
          twilioAuthTokenLength: updateData.twilioAuthToken?.length || 0,
          twilioWhatsappNumber: updateData.twilioWhatsappNumber,
        });

        [config] = await db
          .update(schema.consultantWhatsappConfig)
          .set(updateData)
          .where(eq(schema.consultantWhatsappConfig.id, existingConfig.id))
          .returning();

        console.log(`✅ Updated WhatsApp config ${existingConfig.id} for consultant ${consultantId} - saved token length:`, config.twilioAuthToken?.length || 0);
      } else {
        // Create new config - use effective credentials if useCentralCredentials is enabled
        // CRITICAL: Final validation - ensure token is NOT empty for whatsapp_ai mode before saving
        if (integrationMode === "whatsapp_ai") {
          if (!effectiveTwilioAuthToken || effectiveTwilioAuthToken.trim() === "") {
            console.log("❌ [WHATSAPP CONFIG CREATE] BLOCKING SAVE - Auth token is empty/null!");
            console.log("🔍 [WHATSAPP CONFIG CREATE] Debug info:", {
              useCentralCredentials,
              effectiveTwilioAuthTokenExists: !!effectiveTwilioAuthToken,
              effectiveTwilioAuthTokenLength: effectiveTwilioAuthToken?.length || 0,
              twilioAuthTokenFromBody: twilioAuthToken?.length || 0,
            });
            return res.status(400).json({ 
              message: "Errore critico: Auth Token Twilio è vuoto. Verifica le credenziali nelle Impostazioni API." 
            });
          }
          console.log("✅ [WHATSAPP CONFIG CREATE] Auth token validated - length:", effectiveTwilioAuthToken.length);
        }
        
        console.log("📊 [WHATSAPP CONFIG CREATE] Pre-save data:", {
          agentName,
          twilioAccountSidLength: effectiveTwilioAccountSid?.length || 0,
          twilioAuthTokenLength: effectiveTwilioAuthToken?.length || 0,
          twilioWhatsappNumber,
          useCentralCredentials,
        });
        
        [config] = await db
          .insert(schema.consultantWhatsappConfig)
          .values({
            consultantId,
            agentName,
            integrationMode: integrationMode as "whatsapp_ai" | "ai_only",
            twilioAccountSid: effectiveTwilioAccountSid || null,
            twilioAuthToken: effectiveTwilioAuthToken || null,
            twilioWhatsappNumber: twilioWhatsappNumber || null,
            autoResponseEnabled: autoResponseEnabled ?? true,
            agentType: agentType || "reactive_lead",
            workingHoursEnabled: workingHoursEnabled ?? false,
            workingHoursStart: workingHoursStart || null,
            workingHoursEnd: workingHoursEnd || null,
            workingDays: workingDays || null,
            afterHoursMessage: afterHoursMessage || null,
            businessName: businessName || null,
            businessDescription: businessDescription || null,
            consultantBio: consultantBio || null,
            salesScript: salesScript || null,
            vision: vision || null,
            mission: mission || null,
            values: values || null,
            usp: usp || null,
            whoWeHelp: whoWeHelp || null,
            whoWeDontHelp: whoWeDontHelp || null,
            whatWeDo: whatWeDo || null,
            howWeDoIt: howWeDoIt || null,
            softwareCreated: softwareCreated || null,
            booksPublished: booksPublished || null,
            yearsExperience: yearsExperience || null,
            clientsHelped: clientsHelped || null,
            resultsGenerated: resultsGenerated || null,
            caseStudies: caseStudies || null,
            servicesOffered: servicesOffered || null,
            guarantees: guarantees || null,
            aiPersonality: aiPersonality || "amico_fidato",
            whatsappConciseMode: whatsappConciseMode ?? false,
            defaultObiettivi: defaultObiettivi || null,
            defaultDesideri: defaultDesideri || null,
            defaultUncino: defaultUncino || null,
            defaultIdealState: defaultIdealState || null,
            isDryRun: isDryRun ?? true,
            isActive: true,
            isProactiveAgent: req.body.isProactiveAgent ?? false,
            // Feature Blocks Configuration
            bookingEnabled: bookingEnabled ?? true,
            objectionHandlingEnabled: objectionHandlingEnabled ?? true,
            disqualificationEnabled: disqualificationEnabled ?? true,
            upsellingEnabled: upsellingEnabled ?? false,
            // Agent Instructions Configuration
            agentInstructions: agentInstructions || null,
            agentInstructionsEnabled: agentInstructionsEnabled ?? false,
            selectedTemplate: selectedTemplate || "receptionist",
            businessHeaderMode: businessHeaderMode || "assistant",
            professionalRole: professionalRole || null,
            customBusinessHeader: customBusinessHeader || null,
          })
          .returning();

        console.log(`✅ Created WhatsApp config for consultant ${consultantId} - Agent: ${agentName} - saved token length:`, config.twilioAuthToken?.length || 0);
      }

      // Return config without sensitive credentials (exclude only twilioAuthToken)
      res.json({
        message: existingConfig ? "WhatsApp configuration updated successfully" : "WhatsApp configuration created successfully",
        config: {
          id: config.id,
          agentName: config.agentName,
          twilioAccountSid: config.twilioAccountSid,
          twilioWhatsappNumber: config.twilioWhatsappNumber,
          autoResponseEnabled: config.autoResponseEnabled,
          isActive: config.isActive,
          agentType: config.agentType,
          workingHoursEnabled: config.workingHoursEnabled,
          workingHoursStart: config.workingHoursStart,
          workingHoursEnd: config.workingHoursEnd,
          workingDays: config.workingDays,
          afterHoursMessage: config.afterHoursMessage,
          businessName: config.businessName,
          consultantDisplayName: config.consultantDisplayName,
          businessDescription: config.businessDescription,
          consultantBio: config.consultantBio,
          salesScript: config.salesScript,
          vision: config.vision,
          mission: config.mission,
          values: config.values,
          usp: config.usp,
          whoWeHelp: config.whoWeHelp,
          whoWeDontHelp: config.whoWeDontHelp,
          whatWeDo: config.whatWeDo,
          howWeDoIt: config.howWeDoIt,
          softwareCreated: config.softwareCreated,
          booksPublished: config.booksPublished,
          yearsExperience: config.yearsExperience,
          clientsHelped: config.clientsHelped,
          resultsGenerated: config.resultsGenerated,
          caseStudies: config.caseStudies,
          servicesOffered: servicesOffered,
          guarantees: config.guarantees,
          aiPersonality: config.aiPersonality,
          whatsappConciseMode: config.whatsappConciseMode,
          defaultObiettivi: config.defaultObiettivi,
          defaultDesideri: config.defaultDesideri,
          defaultUncino: config.defaultUncino,
          defaultIdealState: config.defaultIdealState,
          isDryRun: config.isDryRun,
          whatsappTemplates: config.whatsappTemplates,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error saving WhatsApp config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/config/from-idea - Create WhatsApp agent directly from an idea
  app.post("/api/whatsapp/config/from-idea", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { ideaId } = req.body;

      if (!ideaId) {
        return res.status(400).json({ message: "ideaId is required" });
      }

      // Fetch the idea data
      const [idea] = await db
        .select()
        .from(schema.consultantAiIdeas)
        .where(
          and(
            eq(schema.consultantAiIdeas.id, ideaId),
            eq(schema.consultantAiIdeas.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      // Map personality to aiPersonality
      const personalityMap: Record<string, string> = {
        professionale: "consulente_professionale",
        amichevole: "amico_fidato",
        empatico: "consigliere_empatico",
        diretto: "stratega_diretto",
      };
      const aiPersonality = personalityMap[idea.personality || ""] || "amico_fidato";

      // Map suggestedAgentType (already in correct format)
      const agentType = idea.suggestedAgentType || "reactive_lead";

      // Create the WhatsApp agent config
      const [config] = await db
        .insert(schema.consultantWhatsappConfig)
        .values({
          consultantId,
          agentName: idea.name,
          integrationMode: "ai_only" as const,
          twilioAccountSid: null,
          twilioAuthToken: null,
          twilioWhatsappNumber: null,
          autoResponseEnabled: true,
          agentType: agentType as "reactive_lead" | "proactive_setter" | "informative_advisor",
          workingHoursEnabled: false,
          workingHoursStart: null,
          workingHoursEnd: null,
          workingDays: null,
          afterHoursMessage: null,
          businessName: idea.businessName || null,
          businessDescription: idea.description || null,
          consultantBio: null,
          salesScript: null,
          vision: idea.vision || null,
          mission: idea.mission || null,
          values: null,
          usp: idea.usp || null,
          whoWeHelp: idea.whoWeHelp || null,
          whoWeDontHelp: idea.whoWeDontHelp || null,
          whatWeDo: idea.whatWeDo || null,
          howWeDoIt: idea.howWeDoIt || null,
          softwareCreated: null,
          booksPublished: null,
          yearsExperience: null,
          clientsHelped: null,
          resultsGenerated: null,
          caseStudies: null,
          servicesOffered: null,
          guarantees: null,
          aiPersonality: aiPersonality as any,
          whatsappConciseMode: false,
          defaultObiettivi: null,
          defaultDesideri: null,
          defaultUncino: null,
          defaultIdealState: null,
          isDryRun: false,
          isActive: true,
          bookingEnabled: true,
          objectionHandlingEnabled: true,
          disqualificationEnabled: true,
          upsellingEnabled: false,
          agentInstructions: idea.suggestedInstructions || null,
          agentInstructionsEnabled: !!idea.suggestedInstructions,
          selectedTemplate: "custom",
          businessHeaderMode: "assistant",
          professionalRole: null,
          customBusinessHeader: null,
        })
        .returning();

      console.log(`✅ Created WhatsApp agent from idea: ${idea.name} (Agent ID: ${config.id})`);

      // Mark the idea as implemented
      await db
        .update(schema.consultantAiIdeas)
        .set({
          isImplemented: true,
          implementedAgentId: config.id,
          updatedAt: new Date(),
        })
        .where(eq(schema.consultantAiIdeas.id, ideaId));

      console.log(`✅ Marked idea ${ideaId} as implemented with agent ${config.id}`);

      res.json({
        success: true,
        message: "WhatsApp agent created successfully from idea",
        data: {
          id: config.id,
          agentName: config.agentName,
          integrationMode: config.integrationMode,
          agentType: config.agentType,
          aiPersonality: config.aiPersonality,
          businessDescription: config.businessDescription,
          whoWeHelp: config.whoWeHelp,
          whoWeDontHelp: config.whoWeDontHelp,
          whatWeDo: config.whatWeDo,
          howWeDoIt: config.howWeDoIt,
          usp: config.usp,
          agentInstructions: config.agentInstructions,
          agentInstructionsEnabled: config.agentInstructionsEnabled,
          isActive: config.isActive,
          isDryRun: config.isDryRun,
          createdAt: config.createdAt,
        },
        ideaId: ideaId,
      });
    } catch (error: any) {
      console.error("❌ Error creating WhatsApp agent from idea:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/whatsapp/config/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const configId = req.params.id;

      // Verify config belongs to consultant
      const [existingConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, configId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      // Delete the configuration
      await db
        .delete(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, configId));

      console.log(`✅ Deleted WhatsApp config ${configId} (Agent: ${existingConfig.agentName})`);

      res.json({ 
        message: "WhatsApp configuration deleted successfully",
        deletedAgent: existingConfig.agentName 
      });
    } catch (error: any) {
      console.error("❌ Error deleting WhatsApp config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================================================
  // AGENT-SPECIFIC GOOGLE CALENDAR OAuth ENDPOINTS
  // Each agent can have its own Google Calendar for appointments
  // ============================================================================

  // GET /api/whatsapp/agents/calendar-status - Get all agents with their calendar status (dashboard)
  app.get("/api/whatsapp/agents/calendar-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Get all agents for this consultant with calendar fields
      const agents = await db
        .select({
          id: schema.consultantWhatsappConfig.id,
          agentName: schema.consultantWhatsappConfig.agentName,
          agentType: schema.consultantWhatsappConfig.agentType,
          isActive: schema.consultantWhatsappConfig.isActive,
          googleCalendarEmail: schema.consultantWhatsappConfig.googleCalendarEmail,
          googleAccessToken: schema.consultantWhatsappConfig.googleAccessToken,
          googleRefreshToken: schema.consultantWhatsappConfig.googleRefreshToken,
          calendarConnectedAt: schema.consultantWhatsappConfig.calendarConnectedAt,
        })
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId))
        .orderBy(schema.consultantWhatsappConfig.agentName);

      // Map to dashboard format
      const agentsWithCalendarStatus = agents.map(agent => ({
        id: agent.id,
        agentName: agent.agentName,
        agentType: agent.agentType,
        isActive: agent.isActive,
        calendarConnected: !!(agent.googleAccessToken && agent.googleRefreshToken),
        calendarEmail: agent.googleCalendarEmail,
        calendarConnectedAt: agent.calendarConnectedAt,
      }));

      res.json(agentsWithCalendarStatus);
    } catch (error: any) {
      console.error("❌ Error fetching agents calendar status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/agents/:agentId/calendar/status - Check if agent has calendar connected
  app.get("/api/whatsapp/agents/:agentId/calendar/status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;

      // Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { isAgentCalendarConnected } = await import("./google-calendar-service");
      const status = await isAgentCalendarConnected(agentId);

      res.json(status);
    } catch (error: any) {
      console.error("❌ Error checking agent calendar status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/agents/:agentId/calendar/oauth/start - Start OAuth flow for agent
  app.post("/api/whatsapp/agents/:agentId/calendar/oauth/start", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;

      // Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { getAgentAuthorizationUrl, buildBaseUrlFromRequest } = await import("./google-calendar-service");
      const redirectBaseUrl = buildBaseUrlFromRequest(req);
      const authUrl = await getAgentAuthorizationUrl(agentId, redirectBaseUrl);

      if (!authUrl) {
        return res.status(500).json({ 
          message: "Credenziali OAuth globali non configurate. Contatta il SuperAdmin." 
        });
      }

      res.json({ authUrl });
    } catch (error: any) {
      console.error("❌ Error starting agent calendar OAuth:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/agents/calendar/oauth/callback - OAuth callback (handles redirect from Google)
  app.get("/api/whatsapp/agents/calendar/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.redirect("/consultant/whatsapp?calendar_error=missing_params");
      }

      const agentId = state as string;
      const { exchangeAgentCodeForTokens, buildBaseUrlFromRequest } = await import("./google-calendar-service");
      const redirectBaseUrl = buildBaseUrlFromRequest(req);

      const result = await exchangeAgentCodeForTokens(code as string, agentId, redirectBaseUrl);

      if (result.success) {
        console.log(`✅ Agent ${agentId} calendar connected successfully, email: ${result.email}`);
        res.redirect(`/consultant/whatsapp?agent=${agentId}&calendar_connected=true&email=${encodeURIComponent(result.email || '')}`);
      } else {
        console.error(`❌ Failed to connect calendar for agent ${agentId}:`, result.error);
        res.redirect(`/consultant/whatsapp?agent=${agentId}&calendar_error=${encodeURIComponent(result.error || 'unknown')}`);
      }
    } catch (error: any) {
      console.error("❌ Error in agent calendar OAuth callback:", error);
      res.redirect(`/consultant/whatsapp?calendar_error=${encodeURIComponent(error.message)}`);
    }
  });

  // POST /api/whatsapp/agents/:agentId/calendar/disconnect - Disconnect calendar from agent
  app.post("/api/whatsapp/agents/:agentId/calendar/disconnect", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;

      // Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { disconnectAgentCalendar } = await import("./google-calendar-service");
      const success = await disconnectAgentCalendar(agentId);

      if (success) {
        console.log(`✅ Calendar disconnected for agent ${agentId}`);
        res.json({ success: true, message: "Calendario Google scollegato con successo" });
      } else {
        res.status(500).json({ message: "Errore durante la disconnessione del calendario" });
      }
    } catch (error: any) {
      console.error("❌ Error disconnecting agent calendar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/agents/:agentId/calendar/test - Test agent calendar connection
  app.post("/api/whatsapp/agents/:agentId/calendar/test", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.params.agentId;

      // Verify agent belongs to consultant
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (!agentConfig.googleAccessToken || !agentConfig.googleRefreshToken) {
        return res.status(400).json({ 
          success: false, 
          message: "Nessun calendario collegato a questo agente" 
        });
      }

      // Try to fetch events from the agent's calendar
      const { getAgentCalendarClient } = await import("./google-calendar-service");
      const calendar = await getAgentCalendarClient(agentId);

      if (!calendar) {
        return res.status(400).json({ 
          success: false, 
          message: "Impossibile inizializzare il servizio calendario" 
        });
      }

      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: weekLater.toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
      });

      console.log(`✅ Agent ${agentId} calendar test successful - ${events.data.items?.length || 0} events found`);
      
      res.json({ 
        success: true, 
        message: "Connessione al calendario verificata con successo",
        eventsCount: events.data.items?.length || 0,
        calendarEmail: agentConfig.googleCalendarEmail
      });
    } catch (error: any) {
      console.error("❌ Error testing agent calendar:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Errore durante il test della connessione" 
      });
    }
  });

  // POST /api/whatsapp/test-credentials - Test Twilio credentials validity
  // ✅ PROTECTED: Only authenticated consultants can test their own credentials
  app.post("/api/whatsapp/test-credentials", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { twilioAccountSid, twilioAuthToken, twilioWhatsappNumber } = req.body;

      if (!twilioAccountSid || !twilioAuthToken) {
        return res.status(400).json({ 
          success: false, 
          message: "twilioAccountSid e twilioAuthToken sono richiesti" 
        });
      }

      // Test credentials by fetching account info
      const twilio = (await import('twilio')).default;
      const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      
      console.log(`🔍 Testing Twilio credentials for account ${twilioAccountSid}...`);
      
      // Try to fetch account details - this will fail if credentials are invalid
      const account = await twilioClient.api.v2010.accounts(twilioAccountSid).fetch();
      
      console.log(`✅ Twilio credentials valid! Account: ${account.friendlyName}, Status: ${account.status}`);

      // Optionally test WhatsApp number if provided
      let whatsappNumberValid = null;
      if (twilioWhatsappNumber) {
        try {
          // Try to fetch incoming phone numbers to verify the WhatsApp number exists
          const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({ 
            phoneNumber: twilioWhatsappNumber,
            limit: 1 
          });
          
          if (phoneNumbers.length > 0) {
            whatsappNumberValid = true;
            console.log(`✅ WhatsApp number ${twilioWhatsappNumber} trovato nell'account Twilio`);
          } else {
            whatsappNumberValid = false;
            console.warn(`⚠️  WhatsApp number ${twilioWhatsappNumber} NON trovato nell'account`);
          }
        } catch (phoneError: any) {
          console.warn(`⚠️  Errore verifica numero WhatsApp: ${phoneError.message}`);
          whatsappNumberValid = false;
        }
      }

      res.json({
        success: true,
        message: "Credenziali Twilio valide",
        accountInfo: {
          friendlyName: account.friendlyName,
          status: account.status,
          type: account.type,
        },
        whatsappNumberValid,
      });
    } catch (error: any) {
      console.error("❌ Errore test credenziali Twilio:", error);
      
      // Provide specific error messages for common issues
      let errorMessage = "Credenziali Twilio non valide";
      if (error.code === 20003) {
        errorMessage = "Account SID o Auth Token non validi. Verifica le credenziali nella Twilio Console.";
      } else if (error.status === 401) {
        errorMessage = "Autenticazione fallita. Auth Token probabilmente errato.";
      } else if (error.status === 404) {
        errorMessage = "Account SID non trovato. Verifica di aver inserito l'SID corretto.";
      }
      
      res.status(401).json({ 
        success: false, 
        message: errorMessage,
        error: error.message 
      });
    }
  });

  // GET /api/whatsapp/templates - Fetch templates from Twilio for current consultant
  app.get("/api/whatsapp/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentId = req.query.agentId as string;

      // Get agent config(s) - if agentId specified, get that one, otherwise get all active configs
      let configs;
      if (agentId) {
        configs = await db
          .select()
          .from(schema.consultantWhatsappConfig)
          .where(
            and(
              eq(schema.consultantWhatsappConfig.id, agentId),
              eq(schema.consultantWhatsappConfig.consultantId, consultantId),
              eq(schema.consultantWhatsappConfig.isActive, true)
            )
          );
      } else {
        configs = await db
          .select()
          .from(schema.consultantWhatsappConfig)
          .where(
            and(
              eq(schema.consultantWhatsappConfig.consultantId, consultantId),
              eq(schema.consultantWhatsappConfig.isActive, true)
            )
          )
          .orderBy(schema.consultantWhatsappConfig.createdAt);
      }

      if (configs.length === 0) {
        return res.status(404).json({ 
          message: "No active WhatsApp configuration found. Please configure Twilio credentials first.",
          templates: []
        });
      }

      // Fetch templates from all relevant agent configs
      const allTemplates: any[] = [];
      
      for (const config of configs) {
        if (!config.twilioAccountSid || !config.twilioAuthToken) continue;

        try {
          // ✅ BUILD APPROVAL STATUS MAP from cache (templateApprovalStatus field)
          const approvalStatusMap: Record<string, string> = {};
          if (config.templateApprovalStatus) {
            try {
              const cachedStatuses = typeof config.templateApprovalStatus === 'string' 
                ? JSON.parse(config.templateApprovalStatus)
                : config.templateApprovalStatus;
              
              // ✅ FIX: Handle BOTH Object format {sid: {status, checkedAt}} AND Array format [{templateSid, status}]
              if (Array.isArray(cachedStatuses)) {
                // Array format: [{templateSid: 'HX...', status: 'approved'}]
                cachedStatuses.forEach((item: any) => {
                  if (item.templateSid && item.status) {
                    approvalStatusMap[item.templateSid] = item.status;
                  }
                });
              } else if (cachedStatuses && typeof cachedStatuses === 'object') {
                // Object format: {HX123: {status: 'approved', checkedAt: '2025-...'}}
                Object.entries(cachedStatuses).forEach(([sid, statusObj]: [string, any]) => {
                  if (statusObj && typeof statusObj === 'object' && statusObj.status) {
                    approvalStatusMap[sid] = statusObj.status;
                  } else if (typeof statusObj === 'string') {
                    // Legacy format: {HX123: 'approved'}
                    approvalStatusMap[sid] = statusObj;
                  }
                });
              }
              console.log(`📋 Loaded ${Object.keys(approvalStatusMap).length} cached approval statuses for agent ${config.agentName}`);
            } catch (parseError) {
              console.warn(`⚠️  Failed to parse templateApprovalStatus for agent ${config.agentName}:`, parseError);
            }
          }
          
          // Initialize Twilio client for this agent
          const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);

          // Fetch content templates from Twilio
          const contents = await twilioClient.content.v1.contents.list({ 
            pageSize: 50 
          });

          // Helper function to extract body text from WhatsApp template components
          const extractWhatsAppBody = (types: any): string => {
            if (types?.['twilio/whatsapp']?.template?.components) {
              const bodyComponent = types['twilio/whatsapp'].template.components.find(
                (component: any) => component.type === 'BODY'
              );
              return bodyComponent?.text || '';
            }
            return '';
          };

          // Helper function to extract variables from template text
          const extractVariables = (text: string): string[] => {
            const matches = text.match(/\{\{(\d+)\}\}/g) || [];
            return [...new Set(matches.map((m: string) => m.replace(/[{}]/g, '')))].sort();
          };

          // Format templates for this agent and fetch approval status via separate API call
          const newApprovalStatuses: Record<string, { status: string; checkedAt: string }> = {};
          
          const agentTemplates = await Promise.all(contents.map(async (content) => {
            // Try WhatsApp template first (approved templates with components array)
            let bodyText = extractWhatsAppBody(content.types);
            
            // Fall back to text template (legacy/draft templates)
            if (!bodyText) {
              bodyText = content.types?.['twilio/text']?.body || '';
            }
            
            // Extract variables from the body text
            const variables = extractVariables(bodyText);
            
            // ✅ FETCH APPROVAL STATUS VIA SEPARATE API CALL (approvalFetch)
            let approvalStatus: string | undefined = undefined;
            try {
              // Use the dedicated approvalFetch endpoint for accurate status
              const approvalFetch = await twilioClient.content.v1
                .contents(content.sid)
                .approvalFetch()
                .fetch();
              
              const approvalData = approvalFetch as any;
              if (approvalData.whatsapp?.status) {
                approvalStatus = approvalData.whatsapp.status;
                console.log(`✅ [APPROVAL FETCH] Template ${content.friendlyName} (${content.sid}): ${approvalStatus}`);
                // Update cache with fresh status
                newApprovalStatuses[content.sid] = {
                  status: approvalStatus,
                  checkedAt: new Date().toISOString()
                };
              }
            } catch (approvalError: any) {
              // ApprovalFetch might fail for draft templates - that's OK
              console.log(`⚠️  [APPROVAL FETCH] Template ${content.friendlyName}: ${approvalError.message}`);
              // Fallback to cache if API call fails
              approvalStatus = approvalStatusMap[content.sid] || undefined;
            }
            
            // If still no status, use cache
            if (!approvalStatus) {
              approvalStatus = approvalStatusMap[content.sid] || undefined;
            }
            
            return {
              sid: content.sid,
              friendlyName: content.friendlyName,
              language: content.language || 'N/A',
              bodyText,
              variables,
              agentId: config.id,
              agentName: config.agentName,
              approvalStatus,
            };
          }));

          // Update cache in database if we got new statuses
          if (Object.keys(newApprovalStatuses).length > 0) {
            const mergedStatuses = { ...approvalStatusMap };
            Object.entries(newApprovalStatuses).forEach(([sid, statusObj]) => {
              mergedStatuses[sid] = statusObj.status;
            });
            
            // Prepare merged cache object
            const updatedCache: Record<string, { status: string; checkedAt: string }> = {};
            Object.entries(mergedStatuses).forEach(([sid, status]) => {
              const existingObj = newApprovalStatuses[sid];
              updatedCache[sid] = existingObj || { status: status as string, checkedAt: new Date().toISOString() };
            });
            
            // Save to database asynchronously (don't wait)
            db.update(schema.consultantWhatsappConfig)
              .set({ templateApprovalStatus: JSON.stringify(updatedCache) })
              .where(eq(schema.consultantWhatsappConfig.id, config.id))
              .execute()
              .then(() => console.log(`✅ Updated approval status cache for ${config.agentName}`))
              .catch(err => console.error(`❌ Failed to update approval cache:`, err));
          }

          allTemplates.push(...agentTemplates);
        } catch (agentError: any) {
          console.error(`❌ Error fetching templates for agent ${config.agentName}:`, agentError);
        }
      }

      res.json({ 
        templates: allTemplates,
        twilioConsoleUrl: `https://console.twilio.com/us1/develop/sms/content-editor`
      });
    } catch (error: any) {
      console.error("❌ Error fetching Twilio templates:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch templates from Twilio",
        templates: []
      });
    }
  });

  // POST /api/whatsapp/templates/create-defaults - Create the 4 default Italian templates on Twilio
  app.post("/api/whatsapp/templates/create-defaults", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentId } = req.body;

      if (!agentId) {
        return res.status(400).json({ 
          message: "agentId is required. Please select which agent should receive the templates."
        });
      }

      // Get the specific agent config
      const [config] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, agentId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId),
            eq(schema.consultantWhatsappConfig.isActive, true)
          )
        )
        .limit(1);

      if (!config || !config.twilioAccountSid || !config.twilioAuthToken) {
        return res.status(404).json({ 
          message: "Active WhatsApp agent configuration not found for the specified agentId."
        });
      }

      console.log(`🚀 Creating default templates for agent: ${config.agentName} (${config.id})`);

      // Initialize Twilio client for this specific agent
      const twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);

      // Define the 4 Italian templates based on Metodo ORBITALE
      const templatesToCreate = [
        {
          friendlyName: 'orbitale_apertura_it',
          language: 'it',
          body: 'Ciao {{1}}! Sono {{2}} dagli uffici di {{3}}. Ti scrivo perché {{4}}. Dato che non voglio sprecare il tuo tempo: hai 30 secondi da dedicarmi per capire se possiamo aiutarti a raggiungere {{5}}?',
          variables: {
            '1': 'Nome',
            '2': 'NomeConsulente',
            '3': 'NomeAzienda',
            '4': 'Uncino',
            '5': 'StatoIdeale'
          }
        },
        {
          friendlyName: 'orbitale_followup_gentile_it',
          language: 'it',
          body: 'Ciao {{1}}, sono ancora {{2}}. Ho visto che forse il mio messaggio si è perso. Se hai anche solo un minuto, mi farebbe piacere capire se posso esserti d\'aiuto per {{3}}. Cosa ne dici?',
          variables: {
            '1': 'Nome',
            '2': 'NomeConsulente',
            '3': 'StatoIdeale'
          }
        },
        {
          friendlyName: 'orbitale_followup_valore_it',
          language: 'it',
          body: '{{1}}, {{2}} qui. Capisco che potresti essere occupato, ma ho aiutato molte persone nella tua situazione a {{3}}. Vale la pena scambiare due parole?',
          variables: {
            '1': 'Nome',
            '2': 'NomeConsulente',
            '3': 'StatoIdeale'
          }
        },
        {
          friendlyName: 'orbitale_followup_finale_it',
          language: 'it',
          body: 'Ciao {{1}}, questo è il mio ultimo tentativo di contatto. Se {{2}} è ancora importante per te, sono qui. Altrimenti capisco e ti lascio in pace. Fammi sapere!',
          variables: {
            '1': 'Nome',
            '2': 'StatoIdeale'
          }
        }
      ];

      // Check for existing templates to avoid duplicates
      const existingContents = await twilioClient.content.v1.contents.list({ 
        pageSize: 100 
      });

      const existingNames = new Set(existingContents.map(c => c.friendlyName));
      const results = [];
      const skipped = [];
      const errors = [];

      // Create each template if it doesn't exist
      for (const template of templatesToCreate) {
        try {
          if (existingNames.has(template.friendlyName)) {
            console.log(`⏭️  Skipping existing template: ${template.friendlyName}`);
            const existing = existingContents.find(c => c.friendlyName === template.friendlyName);
            skipped.push({
              friendlyName: template.friendlyName,
              sid: existing?.sid,
              reason: 'Template already exists'
            });
            continue;
          }

          console.log(`📝 Creating template: ${template.friendlyName}`);
          
          const content = await twilioClient.content.v1.contents.create({
            friendlyName: template.friendlyName,
            language: template.language,
            variables: template.variables,
            types: {
              'twilio/text': {
                body: template.body
              }
            }
          });

          console.log(`✅ Created template: ${content.sid} (${template.friendlyName})`);
          
          results.push({
            sid: content.sid,
            friendlyName: content.friendlyName,
            language: content.language,
            body: template.body
          });

        } catch (error: any) {
          console.error(`❌ Error creating template ${template.friendlyName}:`, error.message);
          errors.push({
            friendlyName: template.friendlyName,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `Created ${results.length} new templates. ${skipped.length} already existed. ${errors.length} errors.`,
        created: results,
        skipped: skipped,
        errors: errors,
        note: "Templates need WhatsApp/Meta approval (1-48 hours) before use. Check Twilio Console for approval status."
      });

    } catch (error: any) {
      console.error("❌ Error creating default templates:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to create default templates"
      });
    }
  });

  // PATCH /api/whatsapp/config/:id/templates - Update template SIDs for an agent
  app.patch("/api/whatsapp/config/:id/templates", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const configId = req.params.id;
      const { whatsappTemplates } = req.body;

      // Validate that whatsappTemplates has the correct structure
      if (!whatsappTemplates || typeof whatsappTemplates !== 'object') {
        return res.status(400).json({ message: "Invalid template data" });
      }

      // Verify config belongs to consultant
      const [existingConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, configId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      // Fetch template body texts from Twilio for dry run preview
      // Start with existing templateBodies to preserve cached values on fetch failures
      const existingBodies = (existingConfig.templateBodies as any) || {};
      const newTemplateBodies: any = { ...existingBodies };
      
      if (existingConfig.twilioAccountSid && existingConfig.twilioAuthToken) {
        try {
          const twilioClient = twilio(existingConfig.twilioAccountSid, existingConfig.twilioAuthToken);
          
          // Helper to extract body text from WhatsApp template
          const extractWhatsAppBody = (types: any): string => {
            if (types?.['twilio/whatsapp']?.template?.components) {
              const bodyComponent = types['twilio/whatsapp'].template.components.find(
                (component: any) => component.type === 'BODY'
              );
              return bodyComponent?.text || '';
            }
            return '';
          };

          // Fetch body text for each assigned template SID
          const sidToBodyKey: Record<string, string> = {
            openingMessageContentSid: 'openingMessageBody',
            followUpGentleContentSid: 'followUpGentleBody',
            followUpValueContentSid: 'followUpValueBody',
            followUpFinalContentSid: 'followUpFinalBody',
          };

          let fetchedCount = 0;
          let failedCount = 0;

          for (const [sidKey, bodyKey] of Object.entries(sidToBodyKey)) {
            const sid = whatsappTemplates[sidKey];
            
            // If template is unassigned (none), remove cached body
            if (!sid || sid === 'none') {
              delete newTemplateBodies[bodyKey];
              continue;
            }

            // Try to fetch fresh body text from Twilio
            try {
              const content = await twilioClient.content.v1.contents(sid).fetch();
              const bodyText = extractWhatsAppBody(content.types) || content.types?.['twilio/text']?.body || '';
              if (bodyText) {
                newTemplateBodies[bodyKey] = bodyText;
                fetchedCount++;
              } else {
                console.warn(`⚠️  Template ${sid} has no body text, keeping cached value if exists`);
              }
            } catch (fetchError: any) {
              failedCount++;
              console.warn(`⚠️  Could not fetch body text for template ${sid}: ${fetchError.message}`);
              console.warn(`   → Preserving cached body text for ${bodyKey} if exists`);
            }
          }

          if (fetchedCount > 0) {
            console.log(`✅ Fetched ${fetchedCount} fresh template body text(s) from Twilio`);
          }
          if (failedCount > 0) {
            console.warn(`⚠️  Failed to fetch ${failedCount} template(s), using cached values`);
          }
        } catch (twilioError: any) {
          console.warn(`⚠️  Could not connect to Twilio: ${twilioError.message}`);
          console.warn(`   → Preserving all existing templateBodies`);
        }
      }

      // Update both whatsappTemplates and templateBodies
      // Keep templateBodies even if empty object (preserves structure)
      const [updatedConfig] = await db
        .update(schema.consultantWhatsappConfig)
        .set({
          whatsappTemplates: whatsappTemplates,
          templateBodies: Object.keys(newTemplateBodies).length > 0 ? newTemplateBodies : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.consultantWhatsappConfig.id, configId))
        .returning();

      console.log(`✅ Updated WhatsApp templates for agent: ${existingConfig.agentName}`);
      if (Object.keys(newTemplateBodies).length > 0) {
        console.log(`✅ Saved ${Object.keys(newTemplateBodies).length} template body text(s) for dry run preview`);
      }

      res.json({ 
        message: "Template assignments updated successfully",
        config: {
          id: updatedConfig.id,
          agentName: updatedConfig.agentName,
          whatsappTemplates: updatedConfig.whatsappTemplates,
          templateBodies: updatedConfig.templateBodies,
        }
      });
    } catch (error: any) {
      console.error("❌ Error updating WhatsApp templates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/config/:id/defaults - Update default lead values for proactive agent
  app.patch("/api/whatsapp/config/:id/defaults", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const configId = req.params.id;
      const { defaultObiettivi, defaultDesideri, defaultUncino, defaultIdealState } = req.body;

      // Verify config belongs to consultant
      const [existingConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(
          and(
            eq(schema.consultantWhatsappConfig.id, configId),
            eq(schema.consultantWhatsappConfig.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      // Update default lead values
      const [updatedConfig] = await db
        .update(schema.consultantWhatsappConfig)
        .set({
          defaultObiettivi: defaultObiettivi || null,
          defaultDesideri: defaultDesideri || null,
          defaultUncino: defaultUncino || null,
          defaultIdealState: defaultIdealState || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.consultantWhatsappConfig.id, configId))
        .returning();

      console.log(`✅ Updated default lead values for agent: ${existingConfig.agentName}`);

      res.json({ 
        message: "Default lead values updated successfully",
        config: {
          id: updatedConfig.id,
          agentName: updatedConfig.agentName,
          defaultObiettivi: updatedConfig.defaultObiettivi,
          defaultDesideri: updatedConfig.defaultDesideri,
          defaultUncino: updatedConfig.defaultUncino,
          defaultIdealState: updatedConfig.defaultIdealState,
        }
      });
    } catch (error: any) {
      console.error("❌ Error updating default lead values:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // AI Agents - Receptionist Metrics
  app.get("/api/ai-agents/receptionist-metrics", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const [conversationsResult, appointmentsResult] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(schema.whatsappConversations)
          .where(
            and(
              eq(schema.whatsappConversations.consultantId, consultantId),
              eq(schema.whatsappConversations.isActive, true)
            )
          ),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(schema.appointmentBookings)
          .where(
            and(
              eq(schema.appointmentBookings.consultantId, consultantId),
              eq(schema.appointmentBookings.status, "confirmed")
            )
          )
      ]);
      res.json({
        conversationsManaged: conversationsResult[0]?.count || 0,
        appointmentsBooked: appointmentsResult[0]?.count || 0,
      });
    } catch (error: any) {
      console.error("❌ Error fetching AI receptionist metrics:", error);
      res.status(500).json({ message: error.message });
    }
  });

  
  // WhatsApp webhook endpoint for receiving messages from Twilio
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      const timestamp = new Date().toISOString();
      console.log(`\n🔔🔔🔔 [WEBHOOK] Received at ${timestamp} 🔔🔔🔔`);
      console.log(`📞 From: ${req.body.From}`);
      console.log(`📱 To: ${req.body.To}`);
      console.log(`💬 Body: ${req.body.Body?.substring(0, 100)}...`);
      console.log(`🆔 MessageSid: ${req.body.MessageSid}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      await handleWebhook(req.body);
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("❌ WhatsApp webhook error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp Dashboard API Endpoints

  // GET /api/whatsapp/conversations - List active conversations
  app.get("/api/whatsapp/conversations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { filter, agentId } = req.query; // all | leads | clients | unread

      // Build where conditions
      const whereConditions = [
        eq(schema.whatsappConversations.consultantId, consultantId),
        eq(schema.whatsappConversations.isActive, true)
      ];

      // Add agentId filter if specified
      if (agentId && typeof agentId === 'string') {
        whereConditions.push(eq(schema.whatsappConversations.agentConfigId, agentId));
      }

      let query = db
        .select({
          conversation: schema.whatsappConversations,
          lastMessage: schema.whatsappMessages,
          agentConfig: schema.consultantWhatsappConfig,
        })
        .from(schema.whatsappConversations)
        .leftJoin(
          schema.whatsappMessages,
          and(
            eq(schema.whatsappMessages.conversationId, schema.whatsappConversations.id),
            eq(
              schema.whatsappMessages.createdAt,
              db
                .select({ maxCreatedAt: sql`MAX(${schema.whatsappMessages.createdAt})` })
                .from(schema.whatsappMessages)
                .where(eq(schema.whatsappMessages.conversationId, schema.whatsappConversations.id))
            )
          )
        )
        .leftJoin(
          schema.consultantWhatsappConfig,
          eq(schema.consultantWhatsappConfig.id, schema.whatsappConversations.agentConfigId)
        )
        .where(and(...whereConditions))
        .orderBy(desc(schema.whatsappConversations.lastMessageAt))
        .limit(100);

      const conversations = await query;

      // Deduplicate conversations by ID to prevent race condition duplicates
      const deduplicatedConversations = Array.from(
        new Map(
          conversations.map((c) => [c.conversation.id, c])
        ).values()
      );

      // Transform to include unread count and filter
      const result = deduplicatedConversations
        .map((c) => ({
          id: c.conversation.id,
          phoneNumber: c.conversation.phoneNumber,
          userId: c.conversation.userId,
          agentConfigId: c.conversation.agentConfigId,
          agentName: c.agentConfig?.agentName || 'Unknown Agent',
          isLead: c.conversation.isLead,
          aiEnabled: c.conversation.aiEnabled,
          lastMessageAt: c.conversation.lastMessageAt,
          lastMessageFrom: c.conversation.lastMessageFrom,
          messageCount: c.conversation.messageCount,
          unreadByConsultant: c.conversation.unreadByConsultant,
          metadata: c.conversation.metadata,
          testModeOverride: c.conversation.testModeOverride,
          testModeUserId: c.conversation.testModeUserId,
          lastMessage: c.lastMessage
            ? {
                text: c.lastMessage.messageText,
                sender: c.lastMessage.sender,
                createdAt: c.lastMessage.createdAt,
              }
            : null,
        }))
        .filter((c) => {
          if (filter === "leads") return c.isLead;
          if (filter === "clients") return !c.isLead;
          if (filter === "unread") return c.unreadByConsultant > 0;
          return true; // all
        });

      res.json({ conversations: result });
    } catch (error: any) {
      console.error("❌ Error fetching conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/conversations/:id/messages - Get message history
  app.get("/api/whatsapp/conversations/:id/messages", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Get messages with media info
      const messages = await db
        .select({
          message: schema.whatsappMessages,
          media: schema.whatsappMediaFiles,
        })
        .from(schema.whatsappMessages)
        .leftJoin(
          schema.whatsappMediaFiles,
          eq(schema.whatsappMediaFiles.messageId, schema.whatsappMessages.id)
        )
        .where(eq(schema.whatsappMessages.conversationId, conversationId))
        .orderBy(desc(schema.whatsappMessages.createdAt))
        .limit(limit)
        .offset(offset);

      const formattedMessages = messages.map((m) => ({
        id: m.message.id,
        text: m.message.messageText,
        direction: m.message.direction,
        sender: m.message.sender,
        mediaType: m.message.mediaType,
        mediaUrl: m.message.mediaUrl,
        twilioStatus: m.message.twilioStatus,
        createdAt: m.message.createdAt,
        sentAt: m.message.sentAt,
        deliveredAt: m.message.deliveredAt,
        readAt: m.message.readAt,
        metadata: m.message.metadata, // Include metadata for audio duration, transcript, etc.
        media: m.media
          ? {
              fileName: m.media.fileName,
              mimeType: m.media.mimeType,
              fileSize: m.media.fileSize,
              localPath: m.media.localPath,
              aiAnalysis: m.media.aiAnalysis,
              extractedText: m.media.extractedText,
            }
          : null,
      }));

      res.json({
        messages: formattedMessages.reverse(), // Oldest first for chat display
        conversation: {
          id: conversation.id,
          phoneNumber: conversation.phoneNumber,
          isLead: conversation.isLead,
          aiEnabled: conversation.aiEnabled,
        },
      });
    } catch (error: any) {
      console.error("❌ Error fetching messages:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/conversations/:id/send - Send manual message
  app.post("/api/whatsapp/conversations/:id/send", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const { messageText } = req.body;

      if (!messageText || messageText.trim() === "") {
        return res.status(400).json({ message: "Message text is required" });
      }

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Create message record
      const [message] = await db
        .insert(schema.whatsappMessages)
        .values({
          conversationId,
          messageText: messageText.trim(),
          direction: "outbound",
          sender: "consultant",
          mediaType: "text",
        })
        .returning();

      // Send via Twilio
      const twilioSid = await sendWhatsAppMessage(
        consultantId,
        conversation.phoneNumber,
        messageText.trim(),
        message.id,
        { conversationId: conversation.id }
      );

      // Update conversation
      await db
        .update(schema.whatsappConversations)
        .set({
          lastMessageAt: new Date(),
          lastMessageFrom: "consultant",
          messageCount: sql`${schema.whatsappConversations.messageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConversations.id, conversationId));

      res.json({
        message: "Message sent successfully",
        data: {
          id: message.id,
          text: message.messageText,
          twilioSid,
          createdAt: message.createdAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/conversations/:id/ai-toggle - Toggle AI on/off
  app.patch("/api/whatsapp/conversations/:id/ai-toggle", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const { aiEnabled } = req.body;

      if (typeof aiEnabled !== "boolean") {
        return res.status(400).json({ message: "aiEnabled must be a boolean" });
      }

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Update AI status
      await db
        .update(schema.whatsappConversations)
        .set({
          aiEnabled,
          overriddenAt: new Date(),
          overriddenBy: consultantId,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConversations.id, conversationId));

      res.json({
        message: aiEnabled ? "AI enabled for this conversation" : "AI disabled for this conversation",
        aiEnabled,
      });
    } catch (error: any) {
      console.error("❌ Error toggling AI:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/conversations/:id/mark-read - Mark conversation as read
  app.patch("/api/whatsapp/conversations/:id/mark-read", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Update unread count and metadata
      const currentMetadata = (conversation.metadata as any) || {};
      await db
        .update(schema.whatsappConversations)
        .set({
          unreadByConsultant: 0,
          metadata: {
            ...currentMetadata,
            lastReadByConsultant: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConversations.id, conversationId));

      res.json({ message: "Conversation marked as read" });
    } catch (error: any) {
      console.error("❌ Error marking conversation as read:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/conversations/:id/reset - Manually reset conversation
  app.post("/api/whatsapp/conversations/:id/reset", authenticateToken, async (req: Request, res: Response) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Update lastResetAt timestamp
      await db
        .update(schema.whatsappConversations)
        .set({ 
          lastResetAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.whatsappConversations.id, conversationId));

      // Send reset confirmation message to client
      const resetMessage = "Certo! Nessun problema, ricominciamo da capo. 👋\nCosa ti ha spinto a scriverci oggi?";
      
      const [savedMessage] = await db
        .insert(schema.whatsappMessages)
        .values({
          conversationId: conversation.id,
          messageText: resetMessage,
          direction: "outbound",
          sender: "ai",
        })
        .returning();

      // Send via Twilio
      const { sendWhatsAppMessage } = await import("./whatsapp/twilio-client");
      await sendWhatsAppMessage(
        consultantId,
        conversation.phoneNumber,
        resetMessage,
        savedMessage.id,
        { conversationId: conversation.id }
      );

      res.json({ 
        message: "Conversation reset successfully",
        resetAt: new Date()
      });
    } catch (error: any) {
      console.error("❌ Error resetting conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/conversations/:id/test-mode - Configure test mode for conversation
  app.post("/api/whatsapp/conversations/:id/test-mode", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const { testModeOverride, testModeUserId } = req.body;

      // Validate input
      if (testModeOverride && !["client", "lead", "consulente"].includes(testModeOverride)) {
        return res.status(400).json({ message: "testModeOverride must be 'client', 'lead', 'consulente', or null" });
      }

      if (testModeOverride === "client" && !testModeUserId) {
        return res.status(400).json({ message: "testModeUserId is required when testModeOverride is 'client'" });
      }

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // If testModeUserId is provided, verify user exists
      if (testModeUserId) {
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, testModeUserId))
          .limit(1);

        if (!user) {
          return res.status(404).json({ message: "User not found for testModeUserId" });
        }
      }

      // Update conversation with test mode settings
      await db
        .update(schema.whatsappConversations)
        .set({ 
          testModeOverride: testModeOverride || null,
          testModeUserId: testModeUserId || null,
          updatedAt: new Date()
        })
        .where(eq(schema.whatsappConversations.id, conversationId));

      const modeLabel = testModeOverride === "client" ? "Cliente" : testModeOverride === "lead" ? "Lead" : testModeOverride === "consulente" ? "Consulente" : "Disattivato";
      console.log(`🧪 [TEST MODE] Configurato per conversazione ${conversationId}: ${modeLabel}${testModeUserId ? ` (userId: ${testModeUserId})` : ''}`);

      res.json({ 
        message: "Test mode configured successfully",
        testModeOverride: testModeOverride || null,
        testModeUserId: testModeUserId || null
      });
    } catch (error: any) {
      console.error("❌ Error configuring test mode:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE /api/whatsapp/conversations/:id - Delete conversation
  app.delete("/api/whatsapp/conversations/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversazione non trovata" });
      }

      // Delete conversation (cascade will delete messages)
      await db
        .delete(schema.whatsappConversations)
        .where(eq(schema.whatsappConversations.id, conversationId));

      console.log(`🗑️  Conversazione eliminata: ${conversation.phoneNumber} (ID: ${conversationId})`);

      res.json({ 
        message: "Conversazione eliminata con successo",
        phoneNumber: conversation.phoneNumber
      });
    } catch (error: any) {
      console.error("❌ Error deleting conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/conversations/:id/simulate - Simulate customer message in dry run mode
  app.post("/api/whatsapp/conversations/:id/simulate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const { messageText } = req.body;

      if (!messageText || messageText.trim() === "") {
        return res.status(400).json({ message: "Message text is required" });
      }

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // CRITICAL: Check if agent is in dry run mode
      // Require agentConfigId to be present - don't allow simulation for conversations without assigned agent
      if (!conversation.agentConfigId) {
        return res.status(400).json({ 
          message: "Cannot simulate messages for conversations without an assigned agent. Please assign an agent first.",
          noAgent: true
        });
      }

      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, conversation.agentConfigId))
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      // Only allow simulation if agent is EXPLICITLY in dry run mode
      // Treat null/undefined as production (false) to prevent accidental simulation on production agents
      const isDryRun = agentConfig.isDryRun === true;
      if (!isDryRun) {
        return res.status(403).json({ 
          message: "Simulation is only allowed for agents in dry run mode. This agent will send real messages or isDryRun is not explicitly set to true.",
          isDryRun: false
        });
      }

      // Insert simulated message into pending queue (same path as real WhatsApp messages)
      // This ensures the AI processor will pick it up and respond
      const [pendingMessage] = await db
        .insert(schema.whatsappPendingMessages)
        .values({
          conversationId,
          phoneNumber: conversation.phoneNumber,
          messageText: messageText.trim(),
          mediaType: "text",
          twilioSid: `simulated-${nanoid()}`, // Unique ID with simulated prefix
          receivedAt: new Date(),
          metadata: {
            simulated: true,
            simulatedAt: new Date().toISOString(),
            simulatedBy: consultantId,
          },
        })
        .returning();

      console.log(`🧪 [DRY RUN SIMULATOR] Simulated customer message queued for conversation ${conversationId}: "${messageText.trim().substring(0, 50)}..."`);
      console.log(`🧪 [DRY RUN SIMULATOR] Pending message ID: ${pendingMessage.id}, twilioSid: ${pendingMessage.twilioSid}`);

      // Trigger AI processing if AI is enabled
      // The processor will handle conversation updates (messageCount, lastMessageAt, etc.)
      if (conversation.aiEnabled) {
        console.log(`🤖 [DRY RUN SIMULATOR] Triggering AI processing for conversation ${conversationId}`);
        scheduleMessageProcessing(conversation.phoneNumber, consultantId);
      } else {
        console.log(`⏸️  [DRY RUN SIMULATOR] AI disabled for conversation ${conversationId} - no auto-response`);
      }

      res.json({
        message: "Simulated customer message created successfully",
        data: {
          id: pendingMessage.id,
          text: pendingMessage.messageText,
          simulated: true,
          aiTriggered: conversation.aiEnabled,
          queuedAt: pendingMessage.receivedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error simulating customer message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/conversations/:id/simulate-audio - Simulate customer audio message in dry run mode
  app.post("/api/whatsapp/conversations/:id/simulate-audio", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.params.id;
      const { audioData } = req.body; // base64 encoded audio

      if (!audioData || audioData.trim() === "") {
        return res.status(400).json({ message: "Audio data is required (base64 encoded)" });
      }

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if agent is in dry run mode
      if (!conversation.agentConfigId) {
        return res.status(400).json({ 
          message: "Cannot simulate messages for conversations without an assigned agent. Please assign an agent first.",
          noAgent: true
        });
      }

      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, conversation.agentConfigId))
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      // Only allow simulation if agent is in dry run mode
      const isDryRun = agentConfig.isDryRun === true;
      if (!isDryRun) {
        return res.status(403).json({ 
          message: "Simulation is only allowed for agents in dry run mode.",
          isDryRun: false
        });
      }

      // Save audio file to storage
      const storagePath = path.join(process.cwd(), "storage", "whatsapp", "media");
      await fs.promises.mkdir(storagePath, { recursive: true });

      const timestamp = Date.now();
      const fileName = `simulated-audio-${conversationId}-${timestamp}.ogg`;
      const filePath = path.join(storagePath, fileName);

      // Convert base64 to buffer and save
      const audioBuffer = Buffer.from(audioData, 'base64');
      await fs.promises.writeFile(filePath, audioBuffer);

      const fileSizeKB = (audioBuffer.length / 1024).toFixed(2);
      console.log(`🧪 [DRY RUN SIMULATOR] Saved audio file: ${fileName} (${fileSizeKB} KB)`);

      // Insert simulated audio message into pending queue
      const [pendingMessage] = await db
        .insert(schema.whatsappPendingMessages)
        .values({
          conversationId,
          phoneNumber: conversation.phoneNumber,
          messageText: "", // Audio messages have empty text (transcript will be added during processing)
          mediaType: "audio",
          mediaUrl: filePath, // Local file path
          mediaContentType: "audio/ogg",
          twilioSid: `simulated-audio-${nanoid()}`,
          receivedAt: new Date(),
          metadata: {
            simulated: true,
            simulatedAt: new Date().toISOString(),
            simulatedBy: consultantId,
            simulatedAudio: true,
          },
        })
        .returning();

      console.log(`🧪 [DRY RUN SIMULATOR] Simulated audio message queued for conversation ${conversationId}`);
      console.log(`🧪 [DRY RUN SIMULATOR] Pending message ID: ${pendingMessage.id}, twilioSid: ${pendingMessage.twilioSid}`);
      console.log(`🧪 [DRY RUN SIMULATOR] Audio file: ${filePath}`);

      // Trigger AI processing
      if (conversation.aiEnabled) {
        console.log(`🤖 [DRY RUN SIMULATOR] Triggering AI processing for audio message`);
        scheduleMessageProcessing(conversation.phoneNumber, consultantId);
      } else {
        console.log(`⏸️  [DRY RUN SIMULATOR] AI disabled - no auto-response`);
      }

      res.json({
        message: "Simulated audio message created successfully",
        data: {
          id: pendingMessage.id,
          mediaType: "audio",
          fileName,
          fileSize: fileSizeKB,
          simulated: true,
          aiTriggered: conversation.aiEnabled,
          queuedAt: pendingMessage.receivedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error simulating audio message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/simulate-audio - Simulate customer audio message (with file upload)
  app.post("/api/whatsapp/simulate-audio", authenticateToken, requireRole("consultant"), upload.single('audio'), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const conversationId = req.body.conversationId;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ message: "Audio file is required" });
      }

      if (!conversationId) {
        return res.status(400).json({ message: "conversationId is required" });
      }

      console.log(`🧪 [DRY RUN SIMULATOR] Audio upload received:`);
      console.log(`   File: ${audioFile.originalname} (${audioFile.mimetype})`);
      console.log(`   Size: ${(audioFile.size / 1024).toFixed(2)} KB`);
      console.log(`   Path: ${audioFile.path}`);

      // Verify conversation belongs to consultant
      const [conversation] = await db
        .select()
        .from(schema.whatsappConversations)
        .where(
          and(
            eq(schema.whatsappConversations.id, conversationId),
            eq(schema.whatsappConversations.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check if agent is in dry run mode
      if (!conversation.agentConfigId) {
        return res.status(400).json({ 
          message: "Cannot simulate messages for conversations without an assigned agent. Please assign an agent first.",
          noAgent: true
        });
      }

      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, conversation.agentConfigId))
        .limit(1);

      if (!agentConfig) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }

      // Only allow simulation if agent is in dry run mode
      const isDryRun = agentConfig.isDryRun === true;
      if (!isDryRun) {
        return res.status(403).json({ 
          message: "Simulation is only allowed for agents in dry run mode.",
          isDryRun: false
        });
      }

      // Insert simulated audio message into pending queue
      const [pendingMessage] = await db
        .insert(schema.whatsappPendingMessages)
        .values({
          conversationId,
          phoneNumber: conversation.phoneNumber,
          messageText: "", // Audio messages have empty text (transcript will be added during processing)
          mediaType: "audio",
          mediaUrl: audioFile.path, // Use uploaded file path
          mediaContentType: audioFile.mimetype,
          twilioSid: `simulated-audio-${nanoid()}`,
          receivedAt: new Date(),
          metadata: {
            simulated: true,
            simulatedAt: new Date().toISOString(),
            simulatedBy: consultantId,
            simulatedAudio: true,
            originalFilename: audioFile.originalname,
          },
        })
        .returning();

      console.log(`🧪 [DRY RUN SIMULATOR] Simulated audio message queued for conversation ${conversationId}`);
      console.log(`🧪 [DRY RUN SIMULATOR] Pending message ID: ${pendingMessage.id}, twilioSid: ${pendingMessage.twilioSid}`);

      // Trigger AI processing
      if (conversation.aiEnabled) {
        console.log(`🤖 [DRY RUN SIMULATOR] Triggering AI processing for audio message`);
        scheduleMessageProcessing(conversation.phoneNumber, consultantId);
      } else {
        console.log(`⏸️  [DRY RUN SIMULATOR] AI disabled - no auto-response`);
      }

      res.json({
        message: "Simulated audio message created successfully",
        data: {
          id: pendingMessage.id,
          mediaType: "audio",
          fileName: audioFile.originalname,
          fileSize: (audioFile.size / 1024).toFixed(2),
          simulated: true,
          aiTriggered: conversation.aiEnabled,
          queuedAt: pendingMessage.receivedAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error simulating audio message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/users/search - Search users for test mode
  app.get("/api/whatsapp/users/search", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { query } = req.query;

      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const searchPattern = `%${query.toLowerCase()}%`;
      
      const users = await db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          phoneNumber: schema.users.phoneNumber,
        })
        .from(schema.users)
        .where(
          and(
            eq(schema.users.consultantId, consultantId),
            or(
              sql`LOWER(${schema.users.email}) LIKE ${searchPattern}`,
              sql`LOWER(${schema.users.firstName}) LIKE ${searchPattern}`,
              sql`LOWER(${schema.users.lastName}) LIKE ${searchPattern}`,
              sql`${schema.users.phoneNumber} LIKE ${searchPattern}`
            )
          )
        )
        .limit(10);

      res.json(users);
    } catch (error: any) {
      console.error("❌ Error searching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp API Keys Management

  // GET /api/whatsapp/api-keys - List consultant's Gemini API keys
  app.get("/api/whatsapp/api-keys", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const keys = await db
        .select({
          id: schema.whatsappGlobalApiKeys.id,
          apiKey: schema.whatsappGlobalApiKeys.apiKey,
          lastUsedAt: schema.whatsappGlobalApiKeys.lastUsedAt,
          usageCount: schema.whatsappGlobalApiKeys.usageCount,
          isActive: schema.whatsappGlobalApiKeys.isActive,
          createdAt: schema.whatsappGlobalApiKeys.createdAt,
        })
        .from(schema.whatsappGlobalApiKeys)
        .where(eq(schema.whatsappGlobalApiKeys.consultantId, consultantId))
        .orderBy(schema.whatsappGlobalApiKeys.createdAt);

      // Mask API keys for security - NEVER send raw apiKey to frontend
      const maskedKeys = keys.map((key) => ({
        id: key.id,
        apiKeyPreview: `${key.apiKey.substring(0, 8)}...${key.apiKey.substring(key.apiKey.length - 4)}`,
        lastUsedAt: key.lastUsedAt,
        usageCount: key.usageCount,
        isActive: key.isActive,
        createdAt: key.createdAt,
      }));

      res.json({ keys: maskedKeys, count: keys.length, maxKeys: 50 });
    } catch (error: any) {
      console.error("❌ Error fetching API keys:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/api-keys - Add new Gemini API key
  app.post("/api/whatsapp/api-keys", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 20) {
        return res.status(400).json({ message: "Invalid API key format" });
      }

      // Check if consultant already has 50 keys
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.whatsappGlobalApiKeys)
        .where(eq(schema.whatsappGlobalApiKeys.consultantId, consultantId));

      if (countResult.count >= 50) {
        return res.status(400).json({ message: "Limite massimo di 50 API keys raggiunto" });
      }

      // Check if key already exists for this consultant
      const [existing] = await db
        .select()
        .from(schema.whatsappGlobalApiKeys)
        .where(
          and(
            eq(schema.whatsappGlobalApiKeys.consultantId, consultantId),
            eq(schema.whatsappGlobalApiKeys.apiKey, apiKey.trim())
          )
        )
        .limit(1);

      if (existing) {
        return res.status(400).json({ message: "Questa API key è già stata aggiunta" });
      }

      // Insert new key
      const [newKey] = await db
        .insert(schema.whatsappGlobalApiKeys)
        .values({
          consultantId,
          apiKey: apiKey.trim(),
          isActive: true,
        })
        .returning();

      res.json({
        message: "API key aggiunta con successo",
        key: {
          id: newKey.id,
          apiKeyPreview: `${newKey.apiKey.substring(0, 8)}...${newKey.apiKey.substring(newKey.apiKey.length - 4)}`,
          createdAt: newKey.createdAt,
        },
      });
    } catch (error: any) {
      console.error("❌ Error adding API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // DELETE /api/whatsapp/api-keys/:id - Remove API key
  app.delete("/api/whatsapp/api-keys/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const keyId = req.params.id;

      // Verify key belongs to consultant before deleting
      const [key] = await db
        .select()
        .from(schema.whatsappGlobalApiKeys)
        .where(
          and(
            eq(schema.whatsappGlobalApiKeys.id, keyId),
            eq(schema.whatsappGlobalApiKeys.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!key) {
        return res.status(404).json({ message: "API key non trovata" });
      }

      await db
        .delete(schema.whatsappGlobalApiKeys)
        .where(eq(schema.whatsappGlobalApiKeys.id, keyId));

      res.json({ message: "API key rimossa con successo" });
    } catch (error: any) {
      console.error("❌ Error deleting API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/api-keys/:id/toggle - Toggle API key active status
  app.patch("/api/whatsapp/api-keys/:id/toggle", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const keyId = req.params.id;

      // Verify key belongs to consultant
      const [key] = await db
        .select()
        .from(schema.whatsappGlobalApiKeys)
        .where(
          and(
            eq(schema.whatsappGlobalApiKeys.id, keyId),
            eq(schema.whatsappGlobalApiKeys.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!key) {
        return res.status(404).json({ message: "API key non trovata" });
      }

      await db
        .update(schema.whatsappGlobalApiKeys)
        .set({ isActive: !key.isActive })
        .where(eq(schema.whatsappGlobalApiKeys.id, keyId));

      res.json({
        message: `API key ${!key.isActive ? "attivata" : "disattivata"} con successo`,
        isActive: !key.isActive,
      });
    } catch (error: any) {
      console.error("❌ Error toggling API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp Vertex AI Settings Routes
  app.get("/api/whatsapp/vertex-ai/settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getWhatsAppVertexAISettings(req.user!.id);
      
      if (!settings) {
        return res.json({ settings: null });
      }

      // Calculate days remaining (90 days from createdAt)
      const now = new Date();
      const createdAt = new Date(settings.createdAt);
      const daysElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 90 - daysElapsed);

      res.json({
        settings: {
          projectId: settings.projectId,
          location: settings.location,
          enabled: settings.enabled,
          daysRemaining,
          createdAt: settings.createdAt
        }
      });
    } catch (error: any) {
      console.error("❌ Error fetching WhatsApp Vertex AI settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whatsapp/vertex-ai/settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { projectId, location, serviceAccountJson, enabled } = req.body;

      // Validation
      if (!projectId || !location || !serviceAccountJson) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate JSON
      try {
        JSON.parse(serviceAccountJson);
      } catch {
        return res.status(400).json({ error: "Invalid service account JSON" });
      }

      await storage.saveWhatsAppVertexAISettings(req.user!.id, {
        projectId,
        location,
        serviceAccountJson,
        enabled: enabled ?? true
      });

      res.json({ success: true, message: "WhatsApp Vertex AI settings saved" });
    } catch (error: any) {
      console.error("❌ Error saving WhatsApp Vertex AI settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/whatsapp/vertex-ai/settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteWhatsAppVertexAISettings(req.user!.id);
      res.json({ success: true, message: "WhatsApp Vertex AI settings deleted" });
    } catch (error: any) {
      console.error("❌ Error deleting WhatsApp Vertex AI settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // WhatsApp Gemini API Keys Routes
  app.get("/api/whatsapp/api-keys", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const keys = await storage.getWhatsAppGeminiApiKeys(req.user!.id);

      res.json({
        keys: keys.map(k => ({
          id: k.id,
          keyPreview: k.keyPreview,
          isActive: k.isActive,
          usageCount: k.usageCount,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt
        })),
        count: keys.length,
        maxKeys: 50
      });
    } catch (error: any) {
      console.error("❌ Error fetching WhatsApp Gemini API keys:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whatsapp/api-keys", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const { apiKey } = req.body;

      if (!apiKey || apiKey.length < 20) {
        return res.status(400).json({ message: "Invalid API key (min 20 characters)" });
      }

      const existingKeys = await storage.getWhatsAppGeminiApiKeys(req.user!.id);
      if (existingKeys.length >= 50) {
        return res.status(400).json({ message: "Maximum 50 keys allowed" });
      }

      await storage.addWhatsAppGeminiApiKey(req.user!.id, apiKey);
      res.json({ success: true, message: "API key added successfully" });
    } catch (error: any) {
      console.error("❌ Error adding WhatsApp Gemini API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/whatsapp/api-keys/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteWhatsAppGeminiApiKey(req.params.id, req.user!.id);
      res.json({ success: true, message: "API key deleted" });
    } catch (error: any) {
      console.error("❌ Error deleting WhatsApp Gemini API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/whatsapp/api-keys/:id/toggle", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      await storage.toggleWhatsAppGeminiApiKey(req.params.id, req.user!.id);
      res.json({ success: true, message: "API key toggled" });
    } catch (error: any) {
      console.error("❌ Error toggling WhatsApp Gemini API key:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Appointment Management endpoints (reschedule & cancel)
  // POST /api/whatsapp/appointments/:id/reschedule - Reschedule appointment
  app.post("/api/whatsapp/appointments/:id/reschedule", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const appointmentId = req.params.id;
      const consultantId = req.user!.id;
      const { newDate, newTime, duration } = req.body;

      if (!newDate || !newTime) {
        return res.status(400).json({ message: "Data e ora sono obbligatorie" });
      }

      // Get existing appointment
      const [appointment] = await db
        .select()
        .from(schema.appointmentBookings)
        .where(
          and(
            eq(schema.appointmentBookings.id, appointmentId),
            eq(schema.appointmentBookings.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!appointment) {
        return res.status(404).json({ message: "Appuntamento non trovato" });
      }

      if (!appointment.googleEventId) {
        return res.status(400).json({ message: "Appuntamento non ha evento Google Calendar associato" });
      }

      console.log(`\n📅 RESCHEDULE APPOINTMENT`);
      console.log(`   ID: ${appointmentId}`);
      console.log(`   Old: ${appointment.appointmentDate} ${appointment.appointmentTime}`);
      console.log(`   New: ${newDate} ${newTime}`);

      // Get calendar settings for timezone
      const [settings] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);

      const timezone = settings?.timezone || "Europe/Rome";
      const appointmentDuration = duration || settings?.appointmentDuration || 60;

      // Update Google Calendar event
      const success = await updateGoogleCalendarEvent(
        consultantId,
        appointment.googleEventId,
        {
          startDate: newDate,
          startTime: newTime,
          duration: appointmentDuration,
          timezone: timezone
        }
      );

      if (!success) {
        return res.status(500).json({ message: "Errore aggiornamento Google Calendar" });
      }

      // Calculate end time
      const [hours, minutes] = newTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + appointmentDuration;
      const endHour = Math.floor(totalMinutes / 60) % 24;
      const endMinute = totalMinutes % 60;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

      // Update database
      await db
        .update(schema.appointmentBookings)
        .set({
          appointmentDate: newDate,
          appointmentTime: newTime,
          appointmentEndTime: endTime,
          updatedAt: new Date()
        })
        .where(eq(schema.appointmentBookings.id, appointmentId));

      console.log(`✅ Appointment rescheduled successfully`);

      res.json({
        message: "Appuntamento spostato con successo",
        appointment: {
          id: appointmentId,
          date: newDate,
          time: newTime,
          endTime: endTime
        }
      });
    } catch (error: any) {
      console.error("❌ Error rescheduling appointment:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/appointments/:id/cancel - Cancel appointment
  app.patch("/api/whatsapp/appointments/:id/cancel", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const appointmentId = req.params.id;
      const consultantId = req.user!.id;
      const { reason } = req.body;

      // Get existing appointment
      const [appointment] = await db
        .select()
        .from(schema.appointmentBookings)
        .where(
          and(
            eq(schema.appointmentBookings.id, appointmentId),
            eq(schema.appointmentBookings.consultantId, consultantId)
          )
        )
        .limit(1);

      if (!appointment) {
        return res.status(404).json({ message: "Appuntamento non trovato" });
      }

      if (appointment.status === "cancelled") {
        return res.status(400).json({ message: "Appuntamento già cancellato" });
      }

      console.log(`\n❌ CANCEL APPOINTMENT`);
      console.log(`   ID: ${appointmentId}`);
      console.log(`   Date: ${appointment.appointmentDate} ${appointment.appointmentTime}`);
      console.log(`   Reason: ${reason || "Non specificato"}`);

      // Delete from Google Calendar if exists
      if (appointment.googleEventId) {
        const success = await deleteGoogleCalendarEvent(
          consultantId,
          appointment.googleEventId
        );
        
        if (!success) {
          console.warn(`⚠️  Warning: Could not delete Google Calendar event`);
          // Continue anyway to update database
        }
      }

      // Update database status
      await db
        .update(schema.appointmentBookings)
        .set({
          status: "cancelled",
          cancellationReason: reason,
          cancelledAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(schema.appointmentBookings.id, appointmentId));

      console.log(`✅ Appointment cancelled successfully`);

      res.json({
        message: "Appuntamento cancellato con successo",
        appointment: {
          id: appointmentId,
          status: "cancelled",
          cancelledAt: new Date()
        }
      });
    } catch (error: any) {
      console.error("❌ Error cancelling appointment:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // =========================================================================
  // CONSULTANT-AGENT CHAT ENDPOINTS
  // =========================================================================

  // GET /api/whatsapp/agent-chat/agents - Get all active WhatsApp agent configs for the logged-in consultant
  app.get("/api/whatsapp/agent-chat/agents", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      const agents = await db
        .select({
          id: schema.consultantWhatsappConfig.id,
          agentName: schema.consultantWhatsappConfig.agentName,
          agentType: schema.consultantWhatsappConfig.agentType,
          businessName: schema.consultantWhatsappConfig.businessName,
          isActive: schema.consultantWhatsappConfig.isActive,
        })
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.consultantId, consultantId));

      res.json({ data: agents });
    } catch (error: any) {
      console.error("Error fetching agent configs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/agent-chat/conversations - Get conversations for the logged-in consultant
  app.get("/api/whatsapp/agent-chat/conversations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentConfigId = req.query.agentConfigId as string | undefined;

      // Clean up empty conversations older than 24 hours for this consultant only (runs async, doesn't block response)
      storage.cleanupEmptyConsultantAgentConversations(consultantId, 24, agentConfigId).catch(err => {
        console.error('[CLEANUP] Background cleanup failed:', err);
      });

      const conversations = await storage.getConsultantAgentConversations(consultantId, agentConfigId);

      res.json({ data: conversations });
    } catch (error: any) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/agent-chat/public-conversations - Get PUBLIC conversations from shared links
  app.get("/api/whatsapp/agent-chat/public-conversations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const agentConfigId = req.query.agentConfigId as string | undefined;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 [PUBLIC-CONVERSATIONS] Fetching public conversations`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`👤 Consultant: ${consultantId}`);
      console.log(`🔧 Agent filter: ${agentConfigId || 'all'}`);

      const conditions = [
        eq(schema.whatsappAgentConsultantConversations.consultantId, consultantId),
        isNotNull(schema.whatsappAgentConsultantConversations.shareId),
        isNotNull(schema.whatsappAgentConsultantConversations.externalVisitorId)
      ];
      
      if (agentConfigId) {
        conditions.push(eq(schema.whatsappAgentConsultantConversations.agentConfigId, agentConfigId));
      }

      // Fetch conversations with share info
      const conversations = await db
        .select({
          conversation: schema.whatsappAgentConsultantConversations,
          share: schema.whatsappAgentShares,
          agentConfig: schema.consultantWhatsappConfig,
        })
        .from(schema.whatsappAgentConsultantConversations)
        .leftJoin(
          schema.whatsappAgentShares,
          eq(schema.whatsappAgentConsultantConversations.shareId, schema.whatsappAgentShares.id)
        )
        .leftJoin(
          schema.consultantWhatsappConfig,
          eq(schema.whatsappAgentConsultantConversations.agentConfigId, schema.consultantWhatsappConfig.id)
        )
        .where(and(...conditions))
        .orderBy(desc(schema.whatsappAgentConsultantConversations.lastMessageAt));

      console.log(`✅ Found ${conversations.length} public conversations`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Map to include share info
      const mappedConversations = conversations.map(({ conversation, share, agentConfig }) => ({
        id: conversation.id,
        title: conversation.title,
        messageCount: conversation.messageCount,
        lastMessageAt: conversation.lastMessageAt,
        agentConfigId: conversation.agentConfigId,
        externalVisitorId: conversation.externalVisitorId,
        visitorMetadata: conversation.visitorMetadata,
        customerName: conversation.customerName,
        shareInfo: share ? {
          id: share.id,
          slug: share.slug,
          agentName: share.agentName,
          accessType: share.accessType,
        } : null,
        agentInfo: agentConfig ? {
          agentName: agentConfig.agentName,
          businessName: agentConfig.businessName,
        } : null,
      }));

      res.json({ data: mappedConversations });
    } catch (error: any) {
      console.error("Error fetching public conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/agent-chat/conversations - Create new conversation
  app.post("/api/whatsapp/agent-chat/conversations", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { agentConfigId } = req.body;

      if (!agentConfigId) {
        return res.status(400).json({ message: "agentConfigId is required" });
      }

      const conversation = await storage.createConsultantAgentConversation(consultantId, agentConfigId);

      res.status(201).json({ data: conversation });
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // GET /api/whatsapp/agent-chat/conversations/:conversationId/messages - Get messages for a conversation
  app.get("/api/whatsapp/agent-chat/conversations/:conversationId/messages", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { conversationId } = req.params;

      const messages = await storage.getConsultantAgentMessages(conversationId, consultantId);

      // Map database fields to frontend format
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        conversationId: msg.conversationId,
        role: msg.role,
        content: msg.content,
        status: msg.status,
        metadata: msg.metadata,
        transcription: msg.transcription,
        audioUrl: msg.audioUrl,
        audioDuration: msg.audioDuration,
        createdAt: msg.createdAt
      }));

      res.json({ data: formattedMessages });
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/agent-chat/conversations/:conversationId/messages - Send message (STREAMING)
  app.post("/api/whatsapp/agent-chat/conversations/:conversationId/messages", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    const consultantId = req.user!.id;
    const { conversationId } = req.params;
    const { content } = req.body;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📨 [STREAMING-ENDPOINT] New message request`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 Consultant: ${consultantId}`);
    console.log(`💬 Conversation: ${conversationId}`);
    console.log(`📝 Message preview: "${content?.substring(0, 50) || '(empty)'}${content?.length > 50 ? '...' : ''}"`);

    try {
      if (!content || typeof content !== 'string' || content.trim() === '') {
        console.log(`❌ [STREAMING-ENDPOINT] Invalid message content`);
        return res.status(400).json({ message: "Message content is required" });
      }

      // BUG FIX: Fetch conversation BEFORE saving messages to check initial messageCount
      console.log(`\n📥 [STREAMING-ENDPOINT] Fetching conversation to check initial state...`);
      const conversationBefore = await storage.getConsultantAgentConversation(conversationId, consultantId);
      
      if (!conversationBefore) {
        console.error(`❌ [STREAMING-ENDPOINT] Conversation not found or access denied`);
        return res.status(404).json({ message: "Conversation not found or access denied" });
      }

      const initialMessageCount = conversationBefore.messageCount || 0;
      const isFirstExchange = initialMessageCount === 0;
      
      console.log(`✅ [STREAMING-ENDPOINT] Conversation state captured:`);
      console.log(`   - Initial messageCount: ${initialMessageCount}`);
      console.log(`   - Is first exchange: ${isFirstExchange}`);
      console.log(`   - Existing title: ${conversationBefore.title ? `"${conversationBefore.title}"` : 'null'}`);

      // Fetch agent configuration for TTS settings BEFORE streaming
      console.log(`\n📥 [STREAMING-ENDPOINT] Fetching agent configuration for TTS settings...`);
      const [agentConfig] = await db
        .select()
        .from(schema.consultantWhatsappConfig)
        .where(eq(schema.consultantWhatsappConfig.id, conversationBefore.agentConfigId!))
        .limit(1);

      if (!agentConfig) {
        console.warn(`⚠️ [STREAMING-ENDPOINT] Agent config not found, defaulting to text-only mode`);
      }

      console.log(`✅ Agent: ${agentConfig?.agentName || 'unknown'} (TTS: ${agentConfig?.ttsEnabled}, Mode: ${agentConfig?.audioResponseMode})`);

      // Determine if we should send audio and/or text based on audioResponseMode BEFORE streaming
      // Client sent text, so clientSentAudio = false
      const responseDecision = agentConfig?.ttsEnabled 
        ? shouldRespondWithAudio(agentConfig.audioResponseMode || 'always_text', false)
        : { sendAudio: false, sendText: true };
      
      // Track original decision for fallback detection
      const originalSendText = responseDecision.sendText;
      
      console.log(`🎛️ [AUDIO DECISION] Mode: ${agentConfig?.audioResponseMode}, ClientSentText → sendAudio=${responseDecision.sendAudio}, sendText=${responseDecision.sendText}`);

      // Save consultant message BEFORE streaming so AI can see full conversation history
      console.log(`\n💾 [STREAMING-ENDPOINT] Saving consultant message BEFORE streaming...`);
      await storage.createConsultantAgentMessage(conversationId, 'consultant', content, {}, consultantId);
      console.log(`✅ Consultant message saved`);

      // Setup SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullResponse = '';

      try {
        // Stream AI response - processConsultantAgentMessage will see the full history including the message we just saved
        console.log(`\n🤖 [STREAMING-ENDPOINT] Starting AI response stream...`);
        let chunkCount = 0;
        
        for await (const chunk of processConsultantAgentMessage(consultantId, conversationId, content)) {
          fullResponse += chunk;
          chunkCount++;
          // Only emit text chunks if sendText is true (honor audioResponseMode)
          if (responseDecision.sendText) {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          }
        }

        console.log(`✅ [STREAMING-ENDPOINT] AI response complete - ${chunkCount} chunks, ${fullResponse.length} chars`);

        let audioUrl = null;
        let agentAudioDuration = null;
        
        if (responseDecision.sendAudio && agentConfig) {
          console.log('\n🎙️ Generating TTS audio response...');
          
          try {
            // Get AI provider for TTS
            const aiProvider = await getAIProvider(agentConfig.consultantId, agentConfig.consultantId);
            
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

            // Cleanup if needed
            if (aiProvider && aiProvider.cleanup) {
              await aiProvider.cleanup();
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
          res.write(`data: ${JSON.stringify({ text: fullResponse })}\n\n`);
        }

        // IMPORTANT: Always save full response text for AI context, regardless of audioResponseMode
        // The AI needs to see its complete conversation history to maintain context
        const messageContent = fullResponse;
        
        console.log(`\n💾 [STREAMING-ENDPOINT] Saving agent message...`);
        await storage.createConsultantAgentMessage(
          conversationId, 
          'agent', 
          messageContent, 
          { audioUrl, audioDuration: agentAudioDuration }, 
          consultantId
        );
        
        const sentTypes = [];
        if (responseDecision.sendText && messageContent) sentTypes.push('text');
        if (responseDecision.sendAudio && audioUrl) sentTypes.push('audio');
        console.log(`✅ [STREAMING-ENDPOINT] Agent message saved: ${sentTypes.join(' + ') || 'empty'} (metadata: messageCount +1)`);

        // BUG FIX: Generate title ONLY on first exchange (messageCount was 0, now is 2)
        if (isFirstExchange) {
          console.log(`\n🏷️  [STREAMING-ENDPOINT] First exchange detected - generating conversation title...`);
          try {
            const title = await generateConversationTitle(content, consultantId);
            console.log(`✅ [STREAMING-ENDPOINT] Title generated: "${title}"`);
            
            const updated = await storage.updateConsultantAgentConversationTitle(conversationId, title, consultantId);
            if (updated) {
              console.log(`✅ [STREAMING-ENDPOINT] Title saved successfully`);
            } else {
              console.error(`❌ [STREAMING-ENDPOINT] Failed to save title - update returned null`);
            }
          } catch (titleError: any) {
            console.error(`❌ [STREAMING-ENDPOINT] Error generating/saving title:`, titleError);
            // Don't fail the request if title generation fails
          }
        } else {
          console.log(`\nℹ️  [STREAMING-ENDPOINT] Not first exchange (messageCount was ${initialMessageCount}) - skipping title generation`);
        }

        console.log(`\n🎉 [STREAMING-ENDPOINT] Request completed successfully`);
        console.log(`   Initial messageCount: ${initialMessageCount}`);
        console.log(`   Final messageCount: ${initialMessageCount + 2} (consultant + agent messages)`);
        console.log(`   Title generation: ${isFirstExchange ? 'EXECUTED' : 'SKIPPED'}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // Send completion signal with audio metadata
        res.write(`data: ${JSON.stringify({ 
          done: true,
          audioUrl: audioUrl || undefined,
          audioDuration: agentAudioDuration || undefined
        })}\n\n`);
        res.end();
      } catch (streamError: any) {
        console.error(`\n❌ [STREAMING-ENDPOINT] Error during streaming:`, streamError);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`⚠️  [ROLLBACK] No messages were saved (streaming failed before save)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        const errorMessage = streamError.message.includes('API key') 
          ? 'Errore configurazione AI. Verifica le impostazioni API.'
          : streamError.message.includes('quota')
          ? 'Quota AI esaurita. Contatta il supporto.'
          : `Errore AI: ${streamError.message}`;
        
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error(`\n❌ [STREAMING-ENDPOINT] Error processing message:`, error);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // DELETE /api/whatsapp/agent-chat/conversations/:conversationId - Delete conversation
  app.delete("/api/whatsapp/agent-chat/conversations/:conversationId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { conversationId } = req.params;

      const success = await storage.deleteConsultantAgentConversation(conversationId, consultantId);

      if (!success) {
        return res.status(404).json({ message: "Conversation not found or access denied" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // PATCH /api/whatsapp/agent-chat/conversations/:conversationId/title - Update conversation title
  app.patch("/api/whatsapp/agent-chat/conversations/:conversationId/title", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;
      const { conversationId } = req.params;
      const { title } = req.body;

      if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ message: "Title is required" });
      }

      const updatedConversation = await storage.updateConsultantAgentConversationTitle(conversationId, title, consultantId);

      if (!updatedConversation) {
        return res.status(404).json({ message: "Conversation not found or access denied" });
      }

      res.json(updatedConversation);
    } catch (error: any) {
      console.error("Error updating conversation title:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/whatsapp/agent-chat/send-audio - Send voice message (audio upload + transcription + TTS response)
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  app.post(
    '/api/whatsapp/agent-chat/send-audio',
    authenticateToken,
    requireRole("consultant"),
    audioUpload.single('audio'),
    async (req: AuthRequest, res) => {
      const consultantId = req.user!.id;
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎤 [SEND-AUDIO] Voice message upload request');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No audio file provided' });
        }

        const audioBuffer = req.file.buffer;
        const { conversationId, agentConfigId } = req.body;

        if (!conversationId || !agentConfigId) {
          return res.status(400).json({ error: 'conversationId and agentConfigId required' });
        }

        console.log(`📝 Audio size: ${audioBuffer.length} bytes (~${(audioBuffer.length / 1024).toFixed(2)} KB)`);
        console.log(`💬 Conversation: ${conversationId}`);
        console.log(`🤖 Agent: ${agentConfigId}`);

        // 1. Get agent configuration
        console.log('\n📥 [STEP 1] Fetching agent configuration...');
        const [agentConfig] = await db
          .select()
          .from(schema.consultantWhatsappConfig)
          .where(eq(schema.consultantWhatsappConfig.id, agentConfigId))
          .limit(1);

        if (!agentConfig) {
          console.error('❌ Agent configuration not found');
          return res.status(404).json({ error: 'Agent not found' });
        }

        console.log(`✅ Agent: ${agentConfig.agentName} (TTS: ${agentConfig.ttsEnabled})`);

        // 2. Get AI provider (Vertex AI)
        console.log('\n🔌 [STEP 2] Getting Vertex AI provider...');
        const aiProvider = await getAIProvider(consultantId, consultantId);
        console.log(`✅ Provider: ${aiProvider.source}`);

        // 3. Transcribe audio with Vertex AI
        console.log('\n🎧 [STEP 3] Transcribing audio...');
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

        // 4. Save consultant audio file
        console.log('\n💾 [STEP 4] Saving consultant audio...');
        const consultantAudioDir = path.join(process.cwd(), 'uploads', 'audio');
        if (!fs.existsSync(consultantAudioDir)) {
          fs.mkdirSync(consultantAudioDir, { recursive: true });
          console.log(`✅ Created audio directory: ${consultantAudioDir}`);
        }
        
        const consultantFileName = `consultant-audio-${nanoid()}.webm`;
        const consultantFilePath = path.join(consultantAudioDir, consultantFileName);
        fs.writeFileSync(consultantFilePath, audioBuffer);
        const consultantAudioUrl = `/uploads/audio/${consultantFileName}`;
        console.log(`✅ Consultant audio saved: ${consultantAudioUrl}`);

        // Calculate audio duration with fallback for webm files without metadata
        let consultantAudioDuration: number;
        try {
          consultantAudioDuration = Math.round(await getAudioDurationInSeconds(consultantFilePath));
          console.log(`⏱️  Consultant audio duration: ${consultantAudioDuration} seconds (from metadata)`);
        } catch (durationError: any) {
          // Fallback: estimate duration from file size
          // webm with Opus codec: ~16KB per second (bitrate ~128kbps)
          const stats = fs.statSync(consultantFilePath);
          const fileSizeKB = stats.size / 1024;
          consultantAudioDuration = Math.max(1, Math.ceil(fileSizeKB / 16));
          console.warn(`⚠️  Could not read duration from metadata: ${durationError.message}`);
          console.log(`📊 Estimated duration from file size: ${consultantAudioDuration}s (${fileSizeKB.toFixed(2)} KB)`);
        }

        // 5. Save consultant message with transcription, audio URL and duration
        console.log('\n💾 [STEP 5] Saving consultant message...');
        await storage.createConsultantAgentMessage(
          conversationId,
          'consultant',
          transcription,
          { audioUrl: consultantAudioUrl, audioDuration: consultantAudioDuration },
          consultantId
        );
        console.log('✅ Consultant message saved');

        // 6. Generate agent response (streaming)
        console.log('\n🤖 [STEP 6] Generating agent response...');
        let fullResponse = '';
        let chunkCount = 0;

        for await (const chunk of processConsultantAgentMessage(
          consultantId,
          conversationId,
          transcription
        )) {
          fullResponse += chunk;
          chunkCount++;
        }

        console.log(`✅ Agent response generated (${chunkCount} chunks, ${fullResponse.length} chars)`);

        // 7. Determine if we should send audio and/or text based on audioResponseMode
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
          console.log('\n🎙️ [STEP 7] Generating TTS audio with Achernar voice...');

          if (!aiProvider.vertexClient) {
            console.warn('⚠️ [TTS] No VertexAI client available - falling back to text-only');
            responseDecision.sendAudio = false;
            responseDecision.sendText = true;
          } else {
            try {
              const audioBuffer = await generateSpeech({
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
              fs.writeFileSync(filePath, audioBuffer);

              audioUrl = `/uploads/audio/${fileName}`;
              console.log(`✅ Audio saved: ${audioUrl}`);

              // Calculate audio duration with fallback
              try {
                agentAudioDuration = Math.round(await getAudioDurationInSeconds(filePath));
                console.log(`⏱️  Agent audio duration: ${agentAudioDuration} seconds (from metadata)`);
              } catch (durationError: any) {
                // Fallback: estimate duration from file size
                // WAV 24kHz mono 16-bit: ~48KB per second
                const stats = fs.statSync(filePath);
                const fileSizeKB = stats.size / 1024;
                agentAudioDuration = Math.max(1, Math.ceil(fileSizeKB / 48));
                console.warn(`⚠️  Could not read duration from metadata: ${durationError.message}`);
                console.log(`📊 Estimated duration from file size: ${agentAudioDuration}s (${fileSizeKB.toFixed(2)} KB)`);
              }
            } catch (ttsError: any) {
              console.error('❌ [TTS] Error generating audio:', ttsError);
              // Fallback to text-only
              responseDecision.sendAudio = false;
              responseDecision.sendText = true;
            }
          }
        } else {
          console.log('\nℹ️ [STEP 7] TTS disabled or not needed for this response mode');
        }

        // IMPORTANT: Always save full response text for AI context, regardless of audioResponseMode
        // The AI needs to see its complete conversation history to maintain context
        const messageContent = fullResponse;
        
        console.log('\n💾 [STEP 8] Saving agent message...');
        await storage.createConsultantAgentMessage(
          conversationId,
          'agent',
          messageContent,
          { audioUrl, audioDuration: agentAudioDuration },
          consultantId
        );
        
        const sentTypes = [];
        if (responseDecision.sendText && messageContent) sentTypes.push('text');
        if (responseDecision.sendAudio && audioUrl) sentTypes.push('audio');
        console.log(`✅ Agent message saved: ${sentTypes.join(' + ') || 'empty'}`);

        console.log('\n🎉 [SUCCESS] Voice message processed successfully');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Return response (include text only if sendText=true or if fallback happened)
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

  // Google Calendar Settings routes (for consultant)
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead (/api/whatsapp/agents/:agentId/calendar/*)
  // This legacy endpoint is maintained for backwards compatibility only
  app.get("/api/calendar-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] GET /api/calendar-settings called by consultant ${req.user!.id}`);
    console.log(`   → Use /api/whatsapp/agents/:agentId/calendar/* for per-agent calendar management`);
    try {
      const [settings] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id))
        .limit(1);

      if (!settings) {
        return res.json({
          isConfigured: false,
          message: "Google Calendar non ancora configurato"
        });
      }

      // Check if calendar is connected via OAuth (supports global OAuth)
      const googleCalendarConnected = await isGoogleCalendarConnected(req.user!.id);
      
      // Check if using global or personal OAuth
      const hasGlobalOAuth = await googleCalendarService.isGlobalCalendarOAuthConfigured();
      const hasPersonalOAuth = !!(settings.googleOAuthClientId && settings.googleOAuthClientSecret);
      const hasOAuthCredentials = hasGlobalOAuth || hasPersonalOAuth;

      // Check OAuth token status (validity and whether reconnection is needed)
      let oauthTokenStatus = {
        isValid: false,
        needsReconnection: false,
        error: undefined as string | undefined
      };

      if (googleCalendarConnected) {
        try {
          oauthTokenStatus = await googleCalendarService.checkOAuthTokenStatus(req.user!.id);
        } catch (error: any) {
          console.error('Error checking OAuth token status:', error);
          // If check fails, assume it needs reconnection
          oauthTokenStatus = {
            isValid: false,
            needsReconnection: true,
            error: 'Impossibile verificare lo stato del token OAuth'
          };
        }
      }

      // Mask sensitive tokens but show if credentials are configured
      res.json({
        isConfigured: true,
        googleCalendarConnected, // indicates if calendar is connected via OAuth
        hasOAuthCredentials, // true if global or personal OAuth is configured
        googleOAuthClientId: settings.googleOAuthClientId,
        googleOAuthRedirectUri: settings.googleOAuthRedirectUri,
        googleCalendarId: settings.googleCalendarId,
        workingHours: settings.workingHours,
        
        // OAuth Token Status (NEW)
        oauthTokenValid: oauthTokenStatus.isValid,
        oauthNeedsReconnection: oauthTokenStatus.needsReconnection,
        oauthError: oauthTokenStatus.error,
        
        // NEW: Separated configurations
        aiAvailability: settings.aiAvailability || { enabled: true, workingDays: {} },
        appointmentAvailability: settings.appointmentAvailability || {
          enabled: true,
          workingDays: {},
          appointmentDuration: settings.appointmentDuration || 60,
          bufferBefore: settings.bufferBefore || 15,
          bufferAfter: settings.bufferAfter || 15,
          maxDaysInAdvance: settings.maxDaysAhead || 30,
          minNoticeHours: settings.minHoursNotice || 24,
          morningSlot: {
            start: settings.morningSlotStart || "09:00",
            end: settings.morningSlotEnd || "13:00"
          },
          afternoonSlot: {
            start: settings.afternoonSlotStart || "14:00",
            end: settings.afternoonSlotEnd || "18:00"
          }
        },
        
        appointmentDuration: settings.appointmentDuration,
        bufferBefore: settings.bufferBefore,
        bufferAfter: settings.bufferAfter,
        morningSlotStart: settings.morningSlotStart,
        morningSlotEnd: settings.morningSlotEnd,
        afternoonSlotStart: settings.afternoonSlotStart,
        afternoonSlotEnd: settings.afternoonSlotEnd,
        maxDaysAhead: settings.maxDaysAhead,
        minHoursNotice: settings.minHoursNotice,
        timezone: settings.timezone,
        isActive: settings.isActive,
        lastSyncAt: settings.lastSyncAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.post("/api/calendar-settings", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] POST /api/calendar-settings called by consultant ${req.user!.id}`);
    try {
      const {
        googleOAuthClientId,
        googleOAuthClientSecret,
        googleOAuthRedirectUri,
        googleCalendarId,
        workingHours,
        aiAvailability,
        appointmentAvailability,
        appointmentDuration,
        bufferBefore,
        bufferAfter,
        morningSlotStart,
        morningSlotEnd,
        afternoonSlotStart,
        afternoonSlotEnd,
        maxDaysAhead,
        minHoursNotice,
        timezone,
        isActive,
      } = req.body;

      console.log('📝 Saving calendar settings:', {
        consultantId: req.user!.id,
        hasAiAvailability: !!aiAvailability,
        hasAppointmentAvailability: !!appointmentAvailability,
        aiAvailability,
        appointmentAvailability
      });

      // 🔧 EXTRACT VALUES FROM appointmentAvailability JSON TO SEPARATE FIELDS
      // This ensures the separate table fields are synchronized with the JSON
      const extractedAppointmentDuration = appointmentAvailability?.appointmentDuration || appointmentDuration;
      const extractedBufferBefore = appointmentAvailability?.bufferBefore || bufferBefore;
      const extractedBufferAfter = appointmentAvailability?.bufferAfter || bufferAfter;
      const extractedMorningSlotStart = appointmentAvailability?.morningSlot?.start || morningSlotStart;
      const extractedMorningSlotEnd = appointmentAvailability?.morningSlot?.end || morningSlotEnd;
      const extractedAfternoonSlotStart = appointmentAvailability?.afternoonSlot?.start || afternoonSlotStart;
      const extractedAfternoonSlotEnd = appointmentAvailability?.afternoonSlot?.end || afternoonSlotEnd;
      const extractedMaxDaysAhead = appointmentAvailability?.maxDaysInAdvance || maxDaysAhead;
      const extractedMinHoursNotice = appointmentAvailability?.minNoticeHours || minHoursNotice;

      console.log('\n🔍 [DURATION FIX] Extracted values from appointmentAvailability:');
      console.log(`   📊 appointmentDuration: ${extractedAppointmentDuration} (from JSON: ${appointmentAvailability?.appointmentDuration}, from body: ${appointmentDuration})`);
      console.log(`   ⏱️ bufferBefore: ${extractedBufferBefore}`);
      console.log(`   ⏱️ bufferAfter: ${extractedBufferAfter}`);
      console.log(`   🌅 morningSlot: ${extractedMorningSlotStart} - ${extractedMorningSlotEnd}`);
      console.log(`   🌆 afternoonSlot: ${extractedAfternoonSlotStart} - ${extractedAfternoonSlotEnd}`);
      console.log(`   📅 maxDaysAhead: ${extractedMaxDaysAhead}, minHoursNotice: ${extractedMinHoursNotice}\n`);

      // Check if settings already exist
      const [existing] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id))
        .limit(1);

      if (existing) {
        // Update existing settings
        const updateData: any = {
          workingHours,
          appointmentDuration: extractedAppointmentDuration,
          bufferBefore: extractedBufferBefore,
          bufferAfter: extractedBufferAfter,
          morningSlotStart: extractedMorningSlotStart,
          morningSlotEnd: extractedMorningSlotEnd,
          afternoonSlotStart: extractedAfternoonSlotStart,
          afternoonSlotEnd: extractedAfternoonSlotEnd,
          maxDaysAhead: extractedMaxDaysAhead,
          minHoursNotice: extractedMinHoursNotice,
          timezone,
          isActive,
          updatedAt: new Date(),
        };

        // NEW: Update separated configurations if provided
        if (aiAvailability !== undefined) {
          updateData.aiAvailability = aiAvailability;
          console.log('✅ Updating aiAvailability:', aiAvailability);
        }
        if (appointmentAvailability !== undefined) {
          updateData.appointmentAvailability = appointmentAvailability;
          console.log('✅ Updating appointmentAvailability:', appointmentAvailability);
        }

        // Only update OAuth credentials if provided
        if (googleOAuthClientId !== undefined) updateData.googleOAuthClientId = googleOAuthClientId;
        if (googleOAuthClientSecret !== undefined) updateData.googleOAuthClientSecret = googleOAuthClientSecret;
        if (googleOAuthRedirectUri !== undefined) updateData.googleOAuthRedirectUri = googleOAuthRedirectUri;
        if (googleCalendarId !== undefined) updateData.googleCalendarId = googleCalendarId;

        const [updated] = await db
          .update(schema.consultantAvailabilitySettings)
          .set(updateData)
          .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id))
          .returning();

        console.log('✅ Calendar settings updated successfully');
        res.json({ message: "Impostazioni aggiornate", settings: updated });
      } else {
        // Create new settings
        const [created] = await db
          .insert(schema.consultantAvailabilitySettings)
          .values({
            consultantId: req.user!.id,
            googleOAuthClientId,
            googleOAuthClientSecret,
            googleOAuthRedirectUri,
            googleCalendarId,
            workingHours,
            aiAvailability: aiAvailability || { enabled: true, workingDays: {} },
            appointmentAvailability: appointmentAvailability || {
              enabled: true,
              workingDays: {},
              appointmentDuration: 60,
              bufferBefore: 15,
              bufferAfter: 15,
              maxDaysInAdvance: 30,
              minNoticeHours: 24
            },
            appointmentDuration: extractedAppointmentDuration || 60,
            bufferBefore: extractedBufferBefore || 15,
            bufferAfter: extractedBufferAfter || 15,
            morningSlotStart: extractedMorningSlotStart || "09:00",
            morningSlotEnd: extractedMorningSlotEnd || "13:00",
            afternoonSlotStart: extractedAfternoonSlotStart || "14:00",
            afternoonSlotEnd: extractedAfternoonSlotEnd || "18:00",
            maxDaysAhead: extractedMaxDaysAhead || 30,
            minHoursNotice: extractedMinHoursNotice || 24,
            timezone: timezone || "Europe/Rome",
            isActive: isActive !== undefined ? isActive : true,
          })
          .returning();

        console.log('✅ Calendar settings created successfully');
        res.status(201).json({ message: "Impostazioni create", settings: created });
      }
    } catch (error: any) {
      console.error('❌ Error saving calendar settings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.post("/api/calendar-settings/save-tokens", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] POST /api/calendar-settings/save-tokens called by consultant ${req.user!.id}`);
    try {
      const { accessToken, refreshToken, expiresAt } = req.body;

      if (!accessToken || !refreshToken) {
        return res.status(400).json({ message: "Access token e refresh token richiesti" });
      }

      // Check if settings exist
      const [existing] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id))
        .limit(1);

      if (existing) {
        // Update tokens
        await db
          .update(schema.consultantAvailabilitySettings)
          .set({
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken,
            googleTokenExpiresAt: expiresAt ? new Date(expiresAt) : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id));

        res.json({ message: "Token salvati con successo" });
      } else {
        return res.status(404).json({ message: "Configurazione non trovata. Crea prima le impostazioni." });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check if global OAuth is configured for Calendar
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.get("/api/calendar-settings/oauth/global-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] GET /api/calendar-settings/oauth/global-status called`);
    try {
      const { isGlobalCalendarOAuthConfigured } = await import('./google-calendar-service');
      const isConfigured = await isGlobalCalendarOAuthConfigured();
      
      res.json({ 
        globalOAuthConfigured: isConfigured,
        message: isConfigured 
          ? "Credenziali OAuth globali configurate dall'amministratore"
          : "Credenziali OAuth globali non configurate. Contatta l'amministratore."
      });
    } catch (error: any) {
      console.error('Error checking global OAuth status:', error);
      res.status(500).json({ message: error.message, globalOAuthConfigured: false });
    }
  });

  // Google Calendar OAuth endpoints
  // ⚠️ DEPRECATED: Use /api/whatsapp/agents/:agentId/calendar/oauth/start instead
  app.get("/api/calendar-settings/oauth/start", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] GET /api/calendar-settings/oauth/start called by consultant ${req.user!.id}`);
    try {
      const consultantId = req.user!.id;
      
      // ✅ Build base URL from current request (fixes custom domain OAuth redirect)
      const baseUrl = buildBaseUrlFromRequest(req);
      
      // Generate authorization URL with correct redirect URI
      const authUrl = await getAuthorizationUrl(consultantId, baseUrl);
      
      res.json({ authUrl });
    } catch (error: any) {
      console.error('Error starting OAuth flow:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ⚠️ DEPRECATED: Use /api/whatsapp/agents/:agentId/calendar/oauth/callback instead
  app.get("/api/calendar-settings/oauth/callback", async (req, res) => {
    console.log(`⚠️ [DEPRECATED API] GET /api/calendar-settings/oauth/callback called`);
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).send('Missing authorization code or state');
      }

      const consultantId = state as string;
      
      // ✅ Build base URL from current request (MUST match the one used in oauth/start)
      const baseUrl = buildBaseUrlFromRequest(req);
      
      // Exchange code for tokens with same redirect URI
      const { accessToken, refreshToken, expiresAt } = await exchangeCodeForTokens(code as string, consultantId, baseUrl);
      
      // Get primary calendar ID
      const calendarId = await getPrimaryCalendarId(consultantId);
      
      // Check if settings already exist
      const [existing] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);

      if (existing) {
        // Update existing settings with OAuth tokens
        // Also clear legacy consultant-specific OAuth credentials (migration to global OAuth)
        await db
          .update(schema.consultantAvailabilitySettings)
          .set({
            googleCalendarId: calendarId || existing.googleCalendarId,
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken,
            googleTokenExpiresAt: expiresAt,
            googleOAuthClientId: null,
            googleOAuthClientSecret: null,
            googleOAuthRedirectUri: null,
            updatedAt: new Date()
          })
          .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId));
      } else {
        // Create new settings with OAuth tokens
        await db
          .insert(schema.consultantAvailabilitySettings)
          .values({
            consultantId,
            googleCalendarId: calendarId || 'primary',
            googleAccessToken: accessToken,
            googleRefreshToken: refreshToken,
            googleTokenExpiresAt: expiresAt
          });
      }

      // Trigger initial sync
      try {
        await syncGoogleCalendarToLocal(consultantId);
      } catch (syncError) {
        console.error('Initial sync failed:', syncError);
      }

      // Redirect to API settings page (Calendar tab) with success message
      res.redirect('/consultant/api-keys-unified?tab=calendar&oauth=success');
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      res.redirect('/consultant/api-keys-unified?tab=calendar&oauth=error');
    }
  });

  // Check Google Calendar connection status
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.get("/api/calendar-settings/connection-status", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] GET /api/calendar-settings/connection-status called`);
    try {
      const isConnected = await isGoogleCalendarConnected(req.user!.id);
      
      const [settings] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, req.user!.id))
        .limit(1);

      res.json({
        isConnected,
        googleCalendarId: settings?.googleCalendarId,
        googleCalendarEmail: (settings as any)?.googleCalendarEmail,
        lastSyncAt: settings?.lastSyncAt
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test Google Calendar connection - actually tries to fetch events
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.post("/api/calendar-settings/test-connection", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] POST /api/calendar-settings/test-connection called`);
    try {
      const consultantId = req.user!.id;
      
      // Check if connected
      const isConnected = await isGoogleCalendarConnected(consultantId);
      if (!isConnected) {
        return res.status(400).json({ 
          success: false,
          message: "Google Calendar non connesso. Effettua prima l'autenticazione OAuth."
        });
      }

      // Get settings
      const [settings] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);

      // Try to fetch events from Google Calendar (limit to next 7 days for test)
      const calendarId = settings?.googleCalendarId || 'primary';
      const now = new Date();
      const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const events = await googleCalendarService.fetchGoogleCalendarEvents(
        consultantId, 
        now,
        sevenDaysLater
      );

      // Get userinfo for email if not stored
      let calendarEmail = (settings as any)?.googleCalendarEmail;
      if (!calendarEmail) {
        try {
          const userInfo = await googleCalendarService.getGoogleUserInfo(consultantId);
          calendarEmail = userInfo?.email;
          
          // Save email to settings
          if (calendarEmail) {
            await db
              .update(schema.consultantAvailabilitySettings)
              .set({ 
                googleCalendarEmail: calendarEmail,
                updatedAt: new Date() 
              })
              .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId));
          }
        } catch (e) {
          console.error('Could not fetch Google user info:', e);
        }
      }

      res.json({
        success: true,
        message: "Connessione a Google Calendar verificata con successo!",
        eventsFound: events?.length || 0,
        calendarId,
        calendarEmail,
        lastSyncAt: settings?.lastSyncAt
      });
    } catch (error: any) {
      console.error('Test connection error:', error);
      
      // Check for specific error types
      let errorMessage = error.message || 'Errore durante il test di connessione';
      if (error.message?.includes('API has not been used') || error.message?.includes('disabled')) {
        errorMessage = 'L\'API Google Calendar non è abilitata nel progetto Google Cloud. Abilita l\'API dalla console Google Cloud.';
      } else if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired')) {
        errorMessage = 'Il token OAuth è scaduto o revocato. Riconnetti Google Calendar.';
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage 
      });
    }
  });

  // Sync Google Calendar manually
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.post("/api/calendar-settings/sync", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] POST /api/calendar-settings/sync called`);
    try {
      const isConnected = await isGoogleCalendarConnected(req.user!.id);
      
      if (!isConnected) {
        return res.status(400).json({ message: "Google Calendar non connesso. Effettua prima l'autenticazione." });
      }

      const result = await syncGoogleCalendarToLocal(req.user!.id);
      
      res.json({
        message: "Sincronizzazione completata con successo",
        eventCount: result.eventCount
      });
    } catch (error: any) {
      console.error('Sync error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Disconnect Google Calendar (remove OAuth tokens)
  // ⚠️ DEPRECATED: Use per-agent calendar APIs instead
  app.post("/api/calendar-settings/disconnect", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    console.log(`⚠️ [DEPRECATED API] POST /api/calendar-settings/disconnect called`);
    try {
      const consultantId = req.user!.id;
      
      const [existing] = await db
        .select()
        .from(schema.consultantAvailabilitySettings)
        .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ message: "Impostazioni non trovate" });
      }

      // Remove OAuth tokens but keep client credentials
      await db
        .update(schema.consultantAvailabilitySettings)
        .set({
          googleRefreshToken: null,
          googleAccessToken: null,
          googleTokenExpiresAt: null,
          updatedAt: new Date()
        })
        .where(eq(schema.consultantAvailabilitySettings.consultantId, consultantId));

      res.json({ 
        success: true,
        message: "Google Calendar disconnesso con successo" 
      });
    } catch (error: any) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get scheduled appointments for consultant
  app.get("/api/calendar/appointments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
    try {
      const consultantId = req.user!.id;

      // Get appointment bookings from leads (WhatsApp)
      const bookings = await db
        .select()
        .from(schema.appointmentBookings)
        .where(eq(schema.appointmentBookings.consultantId, consultantId));

      // Format WhatsApp bookings for FullCalendar
      const whatsappEvents = bookings.map(booking => ({
        id: `whatsapp-${booking.id}`,
        title: `Lead WhatsApp - ${booking.clientPhone}`,
        start: `${booking.appointmentDate}T${booking.appointmentTime}`,
        end: booking.appointmentEndTime ? `${booking.appointmentDate}T${booking.appointmentEndTime}` : undefined,
        backgroundColor: booking.status === 'confirmed' ? '#10b981' : '#f59e0b',
        borderColor: booking.status === 'confirmed' ? '#059669' : '#d97706',
        extendedProps: {
          source: 'whatsapp',
          phone: booking.clientPhone,
          status: booking.status,
          googleEventId: booking.googleEventId,
        }
      }));

      // Get Google Calendar events (next 30 days)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      let googleCalendarEvents: any[] = [];
      try {
        const gcalEvents = await googleCalendarService.listEvents(
          consultantId,
          startDate,
          endDate
        );

        // Format Google Calendar events for FullCalendar
        googleCalendarEvents = gcalEvents.map((event, index) => ({
          id: `gcal-${index}-${event.start.getTime()}`,
          title: event.summary || 'Impegno Google Calendar',
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          extendedProps: {
            source: 'google_calendar',
            status: event.status,
          }
        }));

        console.log(`✅ Fetched ${googleCalendarEvents.length} Google Calendar events for consultant ${consultantId}`);
      } catch (error: any) {
        console.error('⚠️ Error fetching Google Calendar events:', error.message);
      }

      // Merge both sources
      const allEvents = [...whatsappEvents, ...googleCalendarEvents];

      res.json(allEvents);
    } catch (error: any) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get available appointment slots for consultant (supports agent calendar)
  app.get("/api/calendar/available-slots", async (req: Request, res: Response) => {
    try {
      const { consultantId, startDate, endDate, agentConfigId } = req.query;

      if (!consultantId || !startDate || !endDate) {
        return res.status(400).json({ 
          message: "Missing required parameters: consultantId, startDate, endDate" 
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // AGENT-FIRST: Use agent's availability settings when agentConfigId is provided
      let workingHours: any;
      let appointmentDuration: number;
      let bufferBefore: number;
      let bufferAfter: number;
      let minHoursNotice: number;
      let maxDaysAhead: number;
      let timezone: string;

      if (agentConfigId) {
        // Load agent-specific availability settings
        const [agentConfig] = await db
          .select()
          .from(schema.consultantWhatsappConfig)
          .where(eq(schema.consultantWhatsappConfig.id, agentConfigId as string))
          .limit(1);

        if (!agentConfig) {
          return res.status(404).json({ message: "Agent configuration not found" });
        }

        if (!agentConfig.googleRefreshToken) {
          return res.status(400).json({ 
            message: "Agent does not have a calendar connected. Please connect a Google Calendar to this agent first.",
            code: "AGENT_NO_CALENDAR"
          });
        }

        console.log(`📅 [AVAILABLE-SLOTS] Using AGENT settings: ${agentConfig.agentName} (${agentConfigId})`);

        workingHours = agentConfig.availabilityWorkingHours || {
          monday: { enabled: true, start: "09:00", end: "18:00" },
          tuesday: { enabled: true, start: "09:00", end: "18:00" },
          wednesday: { enabled: true, start: "09:00", end: "18:00" },
          thursday: { enabled: true, start: "09:00", end: "18:00" },
          friday: { enabled: true, start: "09:00", end: "18:00" },
          saturday: { enabled: false, start: "09:00", end: "13:00" },
          sunday: { enabled: false, start: "09:00", end: "13:00" }
        };
        appointmentDuration = agentConfig.availabilityAppointmentDuration || 60;
        bufferBefore = agentConfig.availabilityBufferBefore || 15;
        bufferAfter = agentConfig.availabilityBufferAfter || 15;
        minHoursNotice = agentConfig.availabilityMinHoursNotice || 24;
        maxDaysAhead = agentConfig.availabilityMaxDaysAhead || 30;
        timezone = agentConfig.availabilityTimezone || "Europe/Rome";

        console.log(`   ⚙️ Agent availability: duration=${appointmentDuration}min, buffer=${bufferBefore}/${bufferAfter}min, tz=${timezone}`);
      } else {
        // NO FALLBACK: Agent-independent calendar system requires agentConfigId
        console.error(`❌ [AVAILABLE-SLOTS] agentConfigId is REQUIRED. Consultant-level fallback has been removed.`);
        return res.status(400).json({ 
          message: "agentConfigId is required. Each agent must have its own calendar and availability settings configured.",
          code: "AGENT_CONFIG_REQUIRED"
        });
      }

      // 2. Generate theoretical slots based on working hours
      const theoreticalSlots: Array<{ start: Date; end: Date }> = [];
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek] as keyof typeof workingHours;

        // Check if this day is enabled in workingHours
        const dayConfig = workingHours?.[dayName];
        if (dayConfig?.enabled) {
          // Use workingHours[day].start and workingHours[day].end for slot generation
          // TIMEZONE LOGGING: Track how slots are created
          const dayStartParts = dayConfig.start.split(':');
          const dayEndParts = dayConfig.end.split(':');
          let currentSlotTime = new Date(currentDate);
          currentSlotTime.setHours(parseInt(dayStartParts[0]), parseInt(dayStartParts[1]), 0, 0);
          
          const dayEndTime = new Date(currentDate);
          dayEndTime.setHours(parseInt(dayEndParts[0]), parseInt(dayEndParts[1]), 0, 0);
          
          // LOG: Verify timezone interpretation
          if (theoreticalSlots.length === 0) {
            console.log(`\n🔍 [SLOT GENERATION DEBUG] First slot created:`);
            console.log(`   📅 Date: ${currentDate.toISOString().split('T')[0]}`);
            console.log(`   🕐 Working hours: ${dayConfig.start} - ${dayConfig.end}`);
            console.log(`   🌍 Timezone setting: ${timezone || 'Europe/Rome'}`);
            console.log(`   📍 Slot Start (UTC): ${currentSlotTime.toISOString()}`);
            console.log(`   🌐 Slot Start (Local): ${currentSlotTime.toLocaleString('it-IT', { timeZone: timezone || 'Europe/Rome' })}`);
          }

          // Generate slots from start to end of the day
          while (currentSlotTime < dayEndTime) {
            const slotEnd = new Date(currentSlotTime);
            slotEnd.setMinutes(slotEnd.getMinutes() + appointmentDuration);
            
            if (slotEnd <= dayEndTime) {
              theoreticalSlots.push({
                start: new Date(currentSlotTime),
                end: slotEnd
              });
            }
            
            currentSlotTime.setMinutes(currentSlotTime.getMinutes() + appointmentDuration);
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 3. Fetch existing events from Google Calendar (with agent calendar support)
      const existingEvents = await googleCalendarService.listEvents(
        consultantId as string,
        start,
        end,
        agentConfigId as string | undefined
      );
      console.log(`📅 Found ${existingEvents.length} existing events on Google Calendar`);

      // 4. Filter slots by minHoursNotice and maxDaysAhead
      const now = new Date();
      const minNoticeDate = new Date(now);
      minNoticeDate.setHours(minNoticeDate.getHours() + minHoursNotice);
      
      const maxAdvanceDate = new Date(now);
      maxAdvanceDate.setDate(maxAdvanceDate.getDate() + maxDaysAhead);

      let validSlots = theoreticalSlots.filter(slot => 
        slot.start >= minNoticeDate && slot.start <= maxAdvanceDate
      );

      // 5. Get already booked slots - AGENT-FIRST APPROACH
      let bookedAppointments: Array<{ appointmentDate: string; appointmentTime: string; appointmentEndTime: string | null; status: string }> = [];
      
      if (agentConfigId) {
        // AGENT MODE: Get bookings from appointmentBookings via agent's conversations only
        // This ensures agent isolation - no consultant-level booking leakage
        const agentBookings = await db
          .select({
            appointmentDate: schema.appointmentBookings.appointmentDate,
            appointmentTime: schema.appointmentBookings.appointmentTime,
            appointmentEndTime: schema.appointmentBookings.appointmentEndTime,
            status: schema.appointmentBookings.status,
          })
          .from(schema.appointmentBookings)
          .innerJoin(
            schema.whatsappConversations,
            eq(schema.appointmentBookings.conversationId, schema.whatsappConversations.id)
          )
          .where(
            and(
              eq(schema.whatsappConversations.agentConfigId, agentConfigId as string),
              sql`${schema.appointmentBookings.status} IN ('confirmed', 'pending')`,
              sql`${schema.appointmentBookings.appointmentDate} >= ${start.toISOString().split('T')[0]}`,
              sql`${schema.appointmentBookings.appointmentDate} <= ${end.toISOString().split('T')[0]}`
            )
          );
        
        bookedAppointments = agentBookings;
        console.log(`📅 [AGENT-SLOTS] Found ${bookedAppointments.length} existing bookings for agent ${agentConfigId}`);
      }
      // Note: The else branch has been removed - agentConfigId is now mandatory 
      // and the endpoint returns 400 error earlier if not provided

      // 6. Filter out occupied slots (considering buffer times)
      const availableSlots = validSlots.filter(slot => {
        const slotStartWithBuffer = new Date(slot.start.getTime() - bufferBefore * 60000);
        const slotEndWithBuffer = new Date(slot.end.getTime() + bufferAfter * 60000);

        // Check agent/consultant bookings
        const hasBookingConflict = bookedAppointments.some(booking => {
          const bookingStart = new Date(`${booking.appointmentDate}T${booking.appointmentTime}:00`);
          const bookingEnd = booking.appointmentEndTime 
            ? new Date(`${booking.appointmentDate}T${booking.appointmentEndTime}:00`)
            : new Date(bookingStart.getTime() + appointmentDuration * 60000);
          
          return (
            slotStartWithBuffer < bookingEnd &&
            slotEndWithBuffer > bookingStart
          );
        });

        // Check if slot overlaps with any existing Google Calendar event (already agent-specific)
        const hasGoogleCalendarConflict = existingEvents.some(event => {
          return (
            (slotStartWithBuffer >= event.start && slotStartWithBuffer < event.end) ||
            (slotEndWithBuffer > event.start && slotEndWithBuffer <= event.end) ||
            (slotStartWithBuffer <= event.start && slotEndWithBuffer >= event.end)
          );
        });

        return !hasBookingConflict && !hasGoogleCalendarConflict;
      });

      console.log(`✅ Filtered to ${availableSlots.length} truly available slots (excluding conflicts)`);
      
      // LOG DETTAGLIATO: Mostra data inizio e primi 3 slot per debugging
      console.log(`📅 [AVAILABLE SLOTS] Parametri richiesta:`);
      console.log(`   - consultantId: ${consultantId}`);
      console.log(`   - Data inizio (startDate): ${start.toISOString()}`);
      console.log(`   - Data fine (endDate): ${end.toISOString()}`);
      console.log(`   - Data corrente (now): ${new Date().toISOString()}`);
      console.log(`📅 [AVAILABLE SLOTS] Risultati calcolo:`);
      console.log(`   - Slot teorici generati: ${theoreticalSlots.length}`);
      console.log(`   - Slot dopo filtro minNotice/maxAdvance: ${validSlots.length}`);
      console.log(`   - Slot finali disponibili: ${availableSlots.length}`);
      
      if (availableSlots.length > 0) {
        console.log(`📅 [AVAILABLE SLOTS] Primi 3 slot disponibili:`);
        availableSlots.slice(0, 3).forEach((slot, i) => {
          const slotDate = new Date(slot.start);
          console.log(`   ${i + 1}. ${slotDate.toLocaleString('it-IT', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`);
        });
      } else {
        console.log(`⚠️ [AVAILABLE SLOTS] Nessuno slot disponibile trovato!`);
      }

      res.json({
        slots: availableSlots,
        count: availableSlots.length,
        settings: {
          appointmentDuration,
          bufferBefore,
          bufferAfter,
          timezone
        }
      });
    } catch (error: any) {
      console.error('Error calculating available slots:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // SSE Test endpoint - Server-Sent Events (funziona su Replit)
  app.get("/api/sse-test", (req, res) => {
    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log('📡 SSE client connected');

    // Invia un messaggio ogni secondo
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      const data = {
        message: 'Messaggio da SSE',
        counter,
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }, 1000);

    // Cleanup quando il client si disconnette
    req.on('close', () => {
      console.log('❌ SSE client disconnected');
      clearInterval(interval);
      res.end();
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
