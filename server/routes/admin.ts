import { Router } from "express";
import { authenticateToken, requireSuperAdmin, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { users, systemSettings, adminAuditLog, consultations, exerciseAssignments, consultantAvailabilitySettings } from "../../shared/schema";
import { eq, and, sql, desc, count, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";

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
        .orderBy(desc(users.createdAt));

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
  "/admin/users",
  authenticateToken,
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { email, password, firstName, lastName, role, consultantId, phoneNumber } = req.body;

      if (!email || !password || !firstName || !lastName || !role) {
        return res.status(400).json({ 
          success: false, 
          error: "Email, password, firstName, lastName, and role are required" 
        });
      }

      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        return res.status(400).json({ 
          success: false, 
          error: "User with this email already exists" 
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

      await db.insert(adminAuditLog).values({
        adminId: req.user!.id,
        action: "create_user",
        targetType: "user",
        targetId: newUser.id,
        details: { email, role }
      });

      res.json({
        success: true,
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

export default router;
