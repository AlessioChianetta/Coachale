import { Router } from "express";
import { authenticateToken, requireSuperAdmin, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { users, systemSettings, adminAuditLog, consultations, exerciseAssignments, consultantAvailabilitySettings, superadminVertexConfig, consultantVertexAccess, adminTurnConfig, userRoleProfiles } from "../../shared/schema";
import { eq, and, sql, desc, count, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { getAdminTurnConfig, saveAdminTurnConfig } from "../services/turn-config-service";

const router = Router();

router.get(
  "/admin/stats",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const consultantsResult = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, "consultant"));

      const clientsResult = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, "client"));

      const activeClientsResult = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.role, "client"), eq(users.isActive, true)));

      const driveConnectedResult = await db
        .select({ count: count() })
        .from(consultantAvailabilitySettings)
        .where(isNotNull(consultantAvailabilitySettings.googleDriveRefreshToken));

      const consultationsResult = await db
        .select({ count: count() })
        .from(consultations);

      const exercisesResult = await db
        .select({ count: count() })
        .from(exerciseAssignments);

      res.json({
        success: true,
        stats: {
          totalConsultants: Number(consultantsResult[0]?.count || 0),
          totalClients: Number(clientsResult[0]?.count || 0),
          activeClients: Number(activeClientsResult[0]?.count || 0),
          driveConnections: Number(driveConnectedResult[0]?.count || 0),
          totalConsultations: Number(consultationsResult[0]?.count || 0),
          totalExercises: Number(exercisesResult[0]?.count || 0)
        }
      });
    } catch (error: any) {
      console.error("Admin stats error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/admin/hierarchy",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const consultants = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          isActive: users.isActive,
          createdAt: users.createdAt,
          phoneNumber: users.phoneNumber
        })
        .from(users)
        .where(eq(users.role, "consultant"))
        .orderBy(users.firstName);

      const hierarchy = await Promise.all(
        consultants.map(async (consultant) => {
          const clients = await db
            .select({
              id: users.id,
              username: users.username,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              isActive: users.isActive,
              createdAt: users.createdAt,
              enrolledAt: users.enrolledAt,
              phoneNumber: users.phoneNumber,
              level: users.level
            })
            .from(users)
            .where(
              and(
                eq(users.role, "client"),
                eq(users.consultantId, consultant.id)
              )
            )
            .orderBy(users.firstName);

          const driveSettings = await db
            .select({
              googleDriveEmail: consultantAvailabilitySettings.googleDriveEmail,
              googleDriveConnectedAt: consultantAvailabilitySettings.googleDriveConnectedAt
            })
            .from(consultantAvailabilitySettings)
            .where(eq(consultantAvailabilitySettings.consultantId, consultant.id))
            .limit(1);

          return {
            ...consultant,
            clientCount: clients.length,
            clients,
            googleDriveConnected: !!driveSettings[0]?.googleDriveEmail,
            googleDriveEmail: driveSettings[0]?.googleDriveEmail || null
          };
        })
      );

      res.json({
        success: true,
        hierarchy
      });
    } catch (error: any) {
      console.error("Admin hierarchy error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/admin/users",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      
      const conditions = includeInactive ? undefined : eq(users.isActive, true);

      const allUsers = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          phoneNumber: users.phoneNumber,
          consultantId: users.consultantId,
          level: users.level
        })
        .from(users)
        .where(conditions)
        .orderBy(
          sql`CASE 
            WHEN ${users.role} = 'super_admin' THEN 1 
            WHEN ${users.role} = 'consultant' THEN 2 
            WHEN ${users.role} = 'client' THEN 3 
            ELSE 4
          END`,
          users.firstName,
          users.lastName
        );

      res.json({
        success: true,
        users: allUsers
      });
    } catch (error: any) {
      console.error("Admin users error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.patch(
  "/admin/users/:userId/toggle-active",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { userId } = req.params;
      
      const [user] = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await db
        .update(users)
        .set({ isActive: !user.isActive })
        .where(eq(users.id, userId));

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: user.isActive ? "deactivate_user" : "activate_user",
        targetType: "user",
        targetId: userId,
        details: { previousState: user.isActive }
      });

      res.json({
        success: true,
        isActive: !user.isActive
      });
    } catch (error: any) {
      console.error("Toggle user active error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/admin/settings",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const settings = await db
        .select()
        .from(systemSettings)
        .orderBy(systemSettings.category, systemSettings.key);

      res.json({
        success: true,
        settings
      });
    } catch (error: any) {
      console.error("Admin settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/admin/settings",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { key, value, category, description } = req.body;

      if (!key || !category) {
        return res.status(400).json({ 
          success: false, 
          error: "Key and category are required" 
        });
      }

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, key))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            value,
            description,
            updatedBy: req.user!.id,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, key));
      } else {
        await db.insert(systemSettings).values({
          key,
          value,
          category,
          description,
          updatedBy: req.user!.id
        });
      }

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: existing ? "update_setting" : "create_setting",
        targetType: "setting",
        targetId: key,
        details: { value, category }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Save setting error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/admin/settings/google-oauth",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [clientIdSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "google_oauth_client_id"))
        .limit(1);

      const [clientSecretSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "google_oauth_client_secret"))
        .limit(1);

      res.json({
        success: true,
        configured: !!(clientIdSetting?.value && clientSecretSetting?.value),
        clientId: clientIdSetting?.value || null,
        hasSecret: !!clientSecretSetting?.value
      });
    } catch (error: any) {
      console.error("Get Google OAuth settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/admin/settings/google-oauth",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { clientId, clientSecret } = req.body;

      if (!clientId || !clientSecret) {
        return res.status(400).json({ 
          success: false, 
          error: "Client ID and Client Secret are required" 
        });
      }

      const upsertSetting = async (key: string, value: any, category: string, description: string) => {
        const [existing] = await db
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, key))
          .limit(1);

        if (existing) {
          await db
            .update(systemSettings)
            .set({
              value,
              updatedBy: req.user!.id,
              updatedAt: new Date()
            })
            .where(eq(systemSettings.key, key));
        } else {
          await db.insert(systemSettings).values({
            key,
            value,
            category: category as any,
            description,
            updatedBy: req.user!.id
          });
        }
      };

      await upsertSetting(
        "google_oauth_client_id",
        clientId,
        "google_oauth",
        "Google OAuth Client ID for Drive and Calendar integration"
      );

      await upsertSetting(
        "google_oauth_client_secret",
        clientSecret,
        "google_oauth",
        "Google OAuth Client Secret (encrypted)"
      );

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "update_google_oauth",
        targetType: "setting",
        targetId: "google_oauth",
        details: { clientIdPrefix: clientId.substring(0, 20) + "..." }
      });

      res.json({ 
        success: true,
        message: "Google OAuth credentials saved successfully"
      });
    } catch (error: any) {
      console.error("Save Google OAuth settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Video Meeting OAuth Settings (for Google Sign-In in video meetings)
router.get(
  "/admin/settings/video-meeting-oauth",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [clientIdSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "video_meeting_google_client_id"))
        .limit(1);

      res.json({
        success: true,
        configured: !!clientIdSetting?.value,
        clientId: clientIdSetting?.value || null
      });
    } catch (error: any) {
      console.error("Get Video Meeting OAuth settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/admin/settings/video-meeting-oauth",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { clientId } = req.body;

      if (!clientId) {
        return res.status(400).json({ 
          success: false, 
          error: "Client ID is required" 
        });
      }

      const [existing] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, "video_meeting_google_client_id"))
        .limit(1);

      if (existing) {
        await db
          .update(systemSettings)
          .set({
            value: clientId,
            updatedBy: req.user!.id,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, "video_meeting_google_client_id"));
      } else {
        await db.insert(systemSettings).values({
          key: "video_meeting_google_client_id",
          value: clientId,
          category: "google_oauth" as any,
          description: "Google OAuth Client ID for Video Meeting authentication",
          updatedBy: req.user!.id
        });
      }

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "update_video_meeting_oauth",
        targetType: "setting",
        targetId: "video_meeting_google_client_id",
        details: { clientIdPrefix: clientId.substring(0, 20) + "..." }
      });

      res.json({ 
        success: true,
        message: "Video Meeting OAuth settings saved successfully"
      });
    } catch (error: any) {
      console.error("Save Video Meeting OAuth settings error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/admin/audit-log",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      
      const logs = await db
        .select({
          id: adminAuditLog.id,
          action: adminAuditLog.action,
          targetType: adminAuditLog.targetType,
          targetId: adminAuditLog.targetId,
          details: adminAuditLog.details,
          createdAt: adminAuditLog.createdAt,
          adminEmail: users.email,
          adminName: users.firstName
        })
        .from(adminAuditLog)
        .leftJoin(users, eq(adminAuditLog.adminId, users.id))
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(limit);

      res.json({
        success: true,
        logs
      });
    } catch (error: any) {
      console.error("Admin audit log error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/admin/users/check-email",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ success: false, error: "Email is required" });
      }

      const [existing] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      res.json({
        success: true,
        exists: !!existing,
        existingUser: existing || null
      });
    } catch (error: any) {
      console.error("Check email error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/admin/users",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { email, password, firstName, lastName, role, consultantId, phoneNumber, updateExistingRole } = req.body;

      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({ 
          success: false, 
          error: "Email, firstName, lastName, and role are required" 
        });
      }

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        const existingProfiles = await db
          .select()
          .from(userRoleProfiles)
          .where(eq(userRoleProfiles.userId, existing.id));

        const profileConsultantId = role === "client" ? consultantId : null;
        const existingProfileForRole = existingProfiles.find(p => 
          p.role === role && 
          (role !== "client" || p.consultantId === profileConsultantId)
        );

        if (existingProfileForRole) {
          return res.status(400).json({ 
            success: false, 
            error: role === "client" 
              ? `Questo utente ha già un profilo come Cliente per questo consulente` 
              : `Questo utente ha già un profilo come ${role === 'consultant' ? 'Consulente' : 'Super Admin'}` 
          });
        }

        if (role === "super_admin" && existing.role !== "super_admin") {
          return res.status(400).json({ 
            success: false, 
            error: "Non è possibile aggiungere il ruolo Super Admin. Contatta l'amministratore di sistema." 
          });
        }

        if (!updateExistingRole) {
          return res.status(400).json({ 
            success: false, 
            error: "È necessario confermare esplicitamente l'aggiunta del nuovo ruolo per un utente esistente.",
            requiresConfirmation: true,
            existingUser: {
              id: existing.id,
              email: existing.email,
              firstName: existing.firstName,
              lastName: existing.lastName,
              role: existing.role
            }
          });
        }

        await db
          .update(users)
          .set({ 
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            phoneNumber: phoneNumber || existing.phoneNumber
          })
          .where(eq(users.id, existing.id));

        const [newProfile] = await db
          .insert(userRoleProfiles)
          .values({
            userId: existing.id,
            role,
            consultantId: profileConsultantId,
            isDefault: existingProfiles.length === 0,
            isActive: true
          })
          .returning();

        await db.insert(adminAuditLog).values({
          adminId: req.user!.id,
          action: "add_user_role_profile",
          targetType: "user",
          targetId: existing.id,
          details: { email, newRole: role, existingRole: existing.role, profileId: newProfile.id }
        });

        return res.json({
          success: true,
          existed: true,
          user: {
            id: existing.id,
            email: existing.email,
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            role: existing.role
          },
          message: `Aggiunto profilo ${role === 'consultant' ? 'Consulente' : role === 'client' ? 'Cliente' : 'Super Admin'}. L'utente ora può scegliere il profilo al login.`
        });
      }

      if (!password) {
        return res.status(400).json({ 
          success: false, 
          error: "Password is required for new users" 
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const username = email.split("@")[0] + "_" + Date.now().toString(36);

      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          consultantId: role === "client" ? consultantId : null,
          phoneNumber,
          isActive: true
        })
        .returning();

      await db
        .insert(userRoleProfiles)
        .values({
          userId: newUser.id,
          role,
          consultantId: role === "client" ? consultantId : null,
          isDefault: true,
          isActive: true
        });

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "create_user",
        targetType: "user",
        targetId: newUser.id,
        details: { email, role }
      });

      res.json({
        success: true,
        existed: false,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role
        }
      });
    } catch (error: any) {
      console.error("Create user error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================
// TASK 6: SuperAdmin Vertex AI Configuration
// ============================================

// GET /api/admin/superadmin/vertex-config - Get current SuperAdmin Vertex AI config
router.get(
  "/admin/superadmin/vertex-config",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [config] = await db
        .select({
          id: superadminVertexConfig.id,
          projectId: superadminVertexConfig.projectId,
          location: superadminVertexConfig.location,
          enabled: superadminVertexConfig.enabled,
          createdAt: superadminVertexConfig.createdAt,
          updatedAt: superadminVertexConfig.updatedAt,
        })
        .from(superadminVertexConfig)
        .limit(1);

      res.json({
        success: true,
        config: config || null,
        hasConfig: !!config,
      });
    } catch (error: any) {
      console.error("Get SuperAdmin Vertex config error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/admin/superadmin/vertex-config - Create or update SuperAdmin Vertex AI config
router.post(
  "/admin/superadmin/vertex-config",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { projectId, location, serviceAccountJson, enabled } = req.body;

      if (!projectId || !serviceAccountJson) {
        return res.status(400).json({
          success: false,
          error: "projectId and serviceAccountJson are required",
        });
      }

      // Validate JSON format
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
          return res.status(400).json({
            success: false,
            error: "Invalid service account JSON: missing required fields (project_id, private_key, client_email)",
          });
        }
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          error: "Invalid JSON format for serviceAccountJson",
        });
      }

      // Check if config already exists
      const [existingConfig] = await db
        .select()
        .from(superadminVertexConfig)
        .limit(1);

      let config;
      if (existingConfig) {
        // Update existing config
        [config] = await db
          .update(superadminVertexConfig)
          .set({
            projectId,
            location: location || "us-central1",
            serviceAccountJson,
            enabled: enabled ?? true,
            updatedAt: new Date(),
          })
          .where(eq(superadminVertexConfig.id, existingConfig.id))
          .returning({
            id: superadminVertexConfig.id,
            projectId: superadminVertexConfig.projectId,
            location: superadminVertexConfig.location,
            enabled: superadminVertexConfig.enabled,
            updatedAt: superadminVertexConfig.updatedAt,
          });

        console.log(`✅ Updated SuperAdmin Vertex AI config: project=${projectId}`);
      } else {
        // Create new config
        [config] = await db
          .insert(superadminVertexConfig)
          .values({
            projectId,
            location: location || "us-central1",
            serviceAccountJson,
            enabled: enabled ?? true,
          })
          .returning({
            id: superadminVertexConfig.id,
            projectId: superadminVertexConfig.projectId,
            location: superadminVertexConfig.location,
            enabled: superadminVertexConfig.enabled,
            createdAt: superadminVertexConfig.createdAt,
          });

        console.log(`✅ Created SuperAdmin Vertex AI config: project=${projectId}`);
      }

      // Audit log
      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: existingConfig ? "update_superadmin_vertex_config" : "create_superadmin_vertex_config",
        targetType: "superadmin_vertex_config",
        targetId: config.id,
        details: { projectId, location: location || "us-central1", enabled: enabled ?? true },
      });

      res.json({
        success: true,
        config,
        isNew: !existingConfig,
      });
    } catch (error: any) {
      console.error("Save SuperAdmin Vertex config error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/admin/superadmin/vertex-config/test - Test Vertex AI connection
router.post(
  "/admin/superadmin/vertex-config/test",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      // Get the current config
      const [config] = await db
        .select()
        .from(superadminVertexConfig)
        .limit(1);

      if (!config) {
        return res.status(400).json({
          success: false,
          error: "Nessuna configurazione Vertex AI trovata. Salva prima le credenziali.",
        });
      }

      if (!config.enabled) {
        return res.status(400).json({
          success: false,
          error: "Vertex AI è disabilitato. Abilitalo prima di testare la connessione.",
        });
      }

      // Try to parse and validate the service account JSON
      let serviceAccountData;
      try {
        serviceAccountData = JSON.parse(config.serviceAccountJson);
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          error: "Le credenziali del Service Account non sono in formato JSON valido.",
        });
      }

      // Validate required fields
      if (!serviceAccountData.project_id || !serviceAccountData.private_key || !serviceAccountData.client_email) {
        return res.status(400).json({
          success: false,
          error: "Il Service Account JSON manca dei campi obbligatori (project_id, private_key, client_email).",
        });
      }

      // Try to create a Google Auth client to validate credentials
      const { GoogleAuth } = await import("google-auth-library");
      
      try {
        const auth = new GoogleAuth({
          credentials: serviceAccountData,
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        // Try to get an access token - this validates the credentials
        const client = await auth.getClient();
        await client.getAccessToken();

        console.log(`✅ Vertex AI connection test successful for project: ${config.projectId}`);

        res.json({
          success: true,
          message: `Connessione a Vertex AI riuscita! Project: ${config.projectId}, Location: ${config.location}`,
        });
      } catch (authError: any) {
        console.error("Vertex AI auth test failed:", authError);
        return res.status(400).json({
          success: false,
          error: `Errore di autenticazione Google Cloud: ${authError.message || "Credenziali non valide"}`,
        });
      }
    } catch (error: any) {
      console.error("Vertex config test error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================
// TASK 7: Consultant Vertex Access Management
// ============================================

// GET /api/admin/superadmin/consultant-vertex-access - List all consultants with their Vertex access status
router.get(
  "/admin/superadmin/consultant-vertex-access",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      // Get all consultants
      const consultants = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          useSuperadminVertex: users.useSuperadminVertex,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.role, "consultant"))
        .orderBy(users.firstName);

      // Get all consultant vertex access records
      const accessRecords = await db
        .select()
        .from(consultantVertexAccess);

      // Map access records by consultantId
      const accessMap = new Map(
        accessRecords.map((record) => [record.consultantId, record])
      );

      // Combine data
      const consultantsWithAccess = consultants.map((consultant) => {
        const accessRecord = accessMap.get(consultant.id);
        return {
          ...consultant,
          hasAccess: accessRecord?.hasAccess ?? true, // Default true if no record
          accessRecordId: accessRecord?.id || null,
        };
      });

      res.json({
        success: true,
        consultants: consultantsWithAccess,
      });
    } catch (error: any) {
      console.error("Get consultant vertex access error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// PUT /api/admin/superadmin/consultant-vertex-access/:consultantId - Toggle consultant's Vertex access
router.put(
  "/admin/superadmin/consultant-vertex-access/:consultantId",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { consultantId } = req.params;
      const { hasAccess } = req.body;

      if (typeof hasAccess !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "hasAccess must be a boolean",
        });
      }

      // Verify consultant exists
      const [consultant] = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(and(eq(users.id, consultantId), eq(users.role, "consultant")))
        .limit(1);

      if (!consultant) {
        return res.status(404).json({
          success: false,
          error: "Consultant not found",
        });
      }

      // Check if access record exists
      const [existingRecord] = await db
        .select()
        .from(consultantVertexAccess)
        .where(eq(consultantVertexAccess.consultantId, consultantId))
        .limit(1);

      let record;
      if (existingRecord) {
        // Update existing record
        [record] = await db
          .update(consultantVertexAccess)
          .set({
            hasAccess,
            updatedAt: new Date(),
          })
          .where(eq(consultantVertexAccess.id, existingRecord.id))
          .returning();
      } else {
        // Create new record
        [record] = await db
          .insert(consultantVertexAccess)
          .values({
            consultantId,
            hasAccess,
          })
          .returning();
      }

      console.log(`✅ Updated Vertex access for consultant ${consultant.firstName} ${consultant.lastName}: hasAccess=${hasAccess}`);

      // Audit log
      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "update_consultant_vertex_access",
        targetType: "consultant_vertex_access",
        targetId: consultantId,
        details: { hasAccess, consultantName: `${consultant.firstName} ${consultant.lastName}` },
      });

      res.json({
        success: true,
        record,
      });
    } catch (error: any) {
      console.error("Update consultant vertex access error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Admin TURN Server Configuration - Centralized TURN config with cascade to consultants
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  "/admin/turn-config",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const result = await getAdminTurnConfig();
      res.json({
        success: true,
        ...result
      });
    } catch (error: any) {
      console.error("Get admin TURN config error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.put(
  "/admin/turn-config",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { provider, username, password, apiKey, turnUrls, enabled } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: "Username and password are required"
        });
      }

      if (provider && !["metered", "twilio", "custom"].includes(provider)) {
        return res.status(400).json({
          success: false,
          error: "Invalid provider. Must be 'metered', 'twilio', or 'custom'"
        });
      }

      const result = await saveAdminTurnConfig({
        provider: provider || "metered",
        username,
        password,
        apiKey,
        turnUrls,
        enabled
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "update_admin_turn_config",
        targetType: "setting",
        targetId: result.config?.id,
        details: { provider: provider || "metered", enabled: enabled ?? true },
      });

      res.json({
        success: true,
        message: "Admin TURN configuration saved successfully",
        config: result.config
      });
    } catch (error: any) {
      console.error("Save admin TURN config error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.delete(
  "/admin/turn-config",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [existingConfig] = await db
        .select({ id: adminTurnConfig.id })
        .from(adminTurnConfig)
        .limit(1);

      if (!existingConfig) {
        return res.status(404).json({
          success: false,
          error: "No admin TURN config found"
        });
      }

      await db.delete(adminTurnConfig).where(eq(adminTurnConfig.id, existingConfig.id));

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "delete_admin_turn_config",
        targetType: "setting",
        targetId: existingConfig.id,
        details: {},
      });

      console.log(`✅ Deleted admin TURN config`);

      res.json({
        success: true,
        message: "Admin TURN configuration deleted successfully"
      });
    } catch (error: any) {
      console.error("Delete admin TURN config error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
