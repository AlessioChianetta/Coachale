import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { eq, and, sql, count } from "drizzle-orm";
import { 
  managerUsers, 
  managerLinkAssignments, 
  managerConversations,
  whatsappAgentShares 
} from "@shared/schema";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { sendEmail } from "../services/email-scheduler";
import { storage } from "../storage";

const router = Router();
const JWT_SECRET = process.env.SESSION_SECRET || "manager-fallback-secret-key";

function omitPasswordHash(manager: typeof managerUsers.$inferSelect) {
  const { passwordHash, ...rest } = manager;
  return rest;
}

router.post("/", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { name, email, password, metadata, agentIds, sendEmail: shouldSendEmail } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    // Check SMTP configuration if email sending is requested
    let smtpSettings = null;
    if (shouldSendEmail) {
      smtpSettings = await storage.getConsultantSmtpSettings(consultantId);
      if (!smtpSettings || !smtpSettings.isActive) {
        return res.status(400).json({ 
          message: "Per inviare email devi prima configurare le impostazioni SMTP. Vai su Impostazioni > Email per configurarle.",
          code: "SMTP_NOT_CONFIGURED"
        });
      }
    }

    const existing = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.email, email),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ message: "A manager with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [created] = await db.insert(managerUsers).values({
      consultantId,
      name,
      email,
      passwordHash,
      status: "active",
      metadata: metadata || {},
    }).returning();

    // Auto-assign manager to agent shares if agentIds provided
    let assignedShareUrls: string[] = [];
    if (agentIds && Array.isArray(agentIds) && agentIds.length > 0) {
      // Get all shares for the specified agents that belong to this consultant
      const agentShares = await db.select()
        .from(whatsappAgentShares)
        .where(eq(whatsappAgentShares.consultantId, consultantId));
      
      // Filter shares that match the provided agent IDs
      const matchingShares = agentShares.filter(share => 
        agentIds.includes((share as any).agentConfigId)
      );

      // Create assignments for each matching share
      for (const share of matchingShares) {
        try {
          await db.insert(managerLinkAssignments).values({
            managerId: created.id,
            shareId: share.id,
          });
          // Collect share URLs for email
          const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
            : 'https://example.com';
          assignedShareUrls.push(`${baseUrl}/agent/${share.slug}/login`);
        } catch (assignError) {
          console.log(`[MANAGER] Assignment already exists or failed for share ${share.id}`);
        }
      }
      console.log(`[MANAGER] Created ${matchingShares.length} share assignments for manager ${created.id}`);
    }

    // Send email with credentials if requested and SMTP is configured
    if (shouldSendEmail && smtpSettings) {
      try {
        const loginUrl = assignedShareUrls.length > 0 
          ? assignedShareUrls[0] 
          : (process.env.REPLIT_DEV_DOMAIN 
              ? `https://${process.env.REPLIT_DEV_DOMAIN}/agent/login` 
              : 'Link di accesso');

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0891b2;">Benvenuto come Manager</h2>
            <p>Ciao <strong>${name}</strong>,</p>
            <p>Sei stato invitato come manager per accedere all'assistente AI.</p>
            <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Le tue credenziali di accesso:</strong></p>
              <p style="margin: 5px 0;">Email: <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${email}</code></p>
              <p style="margin: 5px 0;">Password: <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
            </div>
            <p><a href="${loginUrl}" style="display: inline-block; background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Accedi Ora</a></p>
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Ti consigliamo di cambiare la password al primo accesso.</p>
          </div>
        `;

        await sendEmail({
          to: email,
          subject: "Invito Manager - Credenziali di Accesso",
          html: emailHtml,
          consultantId: consultantId,
        });
        console.log(`[MANAGER] Email sent successfully to ${email}`);
      } catch (emailError: any) {
        console.error(`[MANAGER] Failed to send email to ${email}:`, emailError.message);
        // Don't fail the request if email fails - manager is still created
      }
    }

    res.status(201).json(omitPasswordHash(created));
  } catch (error: any) {
    console.error("[MANAGER] Create error:", error);
    res.status(500).json({ message: error.message || "Failed to create manager" });
  }
});

router.get("/", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;

    const managers = await db.select()
      .from(managerUsers)
      .where(eq(managerUsers.consultantId, consultantId));

    const managersWithCounts = await Promise.all(managers.map(async (manager) => {
      const [assignmentCount] = await db.select({ count: count() })
        .from(managerLinkAssignments)
        .where(eq(managerLinkAssignments.managerId, manager.id));

      const [conversationCount] = await db.select({ count: count() })
        .from(managerConversations)
        .where(eq(managerConversations.managerId, manager.id));

      return {
        ...omitPasswordHash(manager),
        assignedAgentsCount: assignmentCount?.count || 0,
        totalConversations: conversationCount?.count || 0,
      };
    }));

    res.json({ managers: managersWithCounts });
  } catch (error: any) {
    console.error("[MANAGER] List error:", error);
    res.status(500).json({ message: error.message || "Failed to list managers" });
  }
});

router.delete("/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.id, id),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    await db.delete(managerUsers).where(eq(managerUsers.id, id));

    res.json({ message: "Manager deleted successfully" });
  } catch (error: any) {
    console.error("[MANAGER] Delete error:", error);
    res.status(500).json({ message: error.message || "Failed to delete manager" });
  }
});

router.put("/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const { name, email, status, metadata, password } = req.body;

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.id, id),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const updateData: Partial<typeof managerUsers.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (status !== undefined) updateData.status = status;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const [updated] = await db.update(managerUsers)
      .set(updateData)
      .where(eq(managerUsers.id, id))
      .returning();

    res.json(omitPasswordHash(updated));
  } catch (error: any) {
    console.error("[MANAGER] Update error:", error);
    res.status(500).json({ message: error.message || "Failed to update manager" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, slug } = req.body;

    if (!email || !password || !slug) {
      return res.status(400).json({ message: "Email, password and slug are required" });
    }

    const [share] = await db.select()
      .from(whatsappAgentShares)
      .where(eq(whatsappAgentShares.slug, slug))
      .limit(1);

    if (!share) {
      return res.status(404).json({ message: "Share link not found" });
    }

    if (!share.isActive) {
      return res.status(403).json({ message: "This share link is no longer active" });
    }

    if (!share.requiresLogin) {
      return res.status(400).json({ message: "This agent does not require login. Access directly via the public link." });
    }

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.email, email),
        eq(managerUsers.consultantId, share.consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (manager.status !== "active") {
      return res.status(403).json({ message: "Account is not active" });
    }

    const isValidPassword = await bcrypt.compare(password, manager.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const [assignment] = await db.select()
      .from(managerLinkAssignments)
      .where(and(
        eq(managerLinkAssignments.managerId, manager.id),
        eq(managerLinkAssignments.shareId, share.id)
      ))
      .limit(1);

    if (!assignment) {
      return res.status(403).json({ message: "You are not assigned to this agent" });
    }

    await db.update(managerUsers)
      .set({
        lastLoginAt: new Date(),
        loginCount: (manager.loginCount || 0) + 1,
        status: "active",
      })
      .where(eq(managerUsers.id, manager.id));

    const token = jwt.sign({
      managerId: manager.id,
      consultantId: share.consultantId,
      shareId: share.id,
      role: "manager",
    }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      manager: omitPasswordHash(manager),
      share: {
        id: share.id,
        slug: share.slug,
        agentName: share.agentName,
      },
    });
  } catch (error: any) {
    console.error("[MANAGER] Login error:", error);
    res.status(500).json({ message: error.message || "Login failed" });
  }
});

router.get("/:id/assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.id, id),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const assignments = await db.select({
      assignment: managerLinkAssignments,
      share: whatsappAgentShares,
    })
      .from(managerLinkAssignments)
      .innerJoin(whatsappAgentShares, eq(managerLinkAssignments.shareId, whatsappAgentShares.id))
      .where(eq(managerLinkAssignments.managerId, id));

    res.json(assignments.map(a => ({
      id: a.assignment.id,
      shareId: a.share.id,
      slug: a.share.slug,
      agentName: a.share.agentName,
      assignedAt: a.assignment.assignedAt,
    })));
  } catch (error: any) {
    console.error("[MANAGER] Get assignments error:", error);
    res.status(500).json({ message: error.message || "Failed to get assignments" });
  }
});

router.post("/:id/assignments", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id } = req.params;
    const { shareId } = req.body;

    if (!shareId) {
      return res.status(400).json({ message: "shareId is required" });
    }

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.id, id),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const [share] = await db.select()
      .from(whatsappAgentShares)
      .where(and(
        eq(whatsappAgentShares.id, shareId),
        eq(whatsappAgentShares.consultantId, consultantId)
      ))
      .limit(1);

    if (!share) {
      return res.status(404).json({ message: "Share link not found" });
    }

    const [existing] = await db.select()
      .from(managerLinkAssignments)
      .where(and(
        eq(managerLinkAssignments.managerId, id),
        eq(managerLinkAssignments.shareId, shareId)
      ))
      .limit(1);

    if (existing) {
      return res.status(400).json({ message: "Assignment already exists" });
    }

    const [assignment] = await db.insert(managerLinkAssignments).values({
      managerId: id,
      shareId,
      assignedBy: consultantId,
    }).returning();

    res.status(201).json({
      id: assignment.id,
      shareId: share.id,
      slug: share.slug,
      agentName: share.agentName,
      assignedAt: assignment.assignedAt,
    });
  } catch (error: any) {
    console.error("[MANAGER] Create assignment error:", error);
    res.status(500).json({ message: error.message || "Failed to create assignment" });
  }
});

router.delete("/:id/assignments/:shareId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { id, shareId } = req.params;

    const [manager] = await db.select()
      .from(managerUsers)
      .where(and(
        eq(managerUsers.id, id),
        eq(managerUsers.consultantId, consultantId)
      ))
      .limit(1);

    if (!manager) {
      return res.status(404).json({ message: "Manager not found" });
    }

    const result = await db.delete(managerLinkAssignments)
      .where(and(
        eq(managerLinkAssignments.managerId, id),
        eq(managerLinkAssignments.shareId, shareId)
      ));

    res.json({ message: "Assignment removed successfully" });
  } catch (error: any) {
    console.error("[MANAGER] Remove assignment error:", error);
    res.status(500).json({ message: error.message || "Failed to remove assignment" });
  }
});

export default router;
