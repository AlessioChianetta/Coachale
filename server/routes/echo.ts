import { Router } from "express";
import { db } from "../db";
import { consultations, consultationTasks, users, emailDrafts } from "../../shared/schema";
import { eq, and, desc, sql, isNull, ne, notExists } from "drizzle-orm";
import { generateConsultationSummaryEmail } from "../ai/email-template-generator";
import { storage } from "../storage";

const router = Router();

// Get Echo statistics for consultant
router.get("/stats", async (req: any, res) => {
  try {
    const consultantId = req.user.id;

    // Count total emails generated (status = sent or approved)
    const totalEmailsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultations)
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          sql`${consultations.summaryEmailStatus} IN ('sent', 'approved')`
        )
      );

    // Count total tasks extracted by Echo
    const totalTasksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultationTasks)
      .innerJoin(consultations, eq(consultationTasks.consultationId, consultations.id))
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultationTasks.source, "echo_extracted")
        )
      );

    // Count pending approvals (status = draft)
    const pendingApprovalsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultations)
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.summaryEmailStatus, "draft")
        )
      );

    // Count missing emails (completed consultations without email)
    const missingEmailsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultations)
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.status, "completed"),
          sql`${consultations.summaryEmailStatus} = 'missing' OR ${consultations.summaryEmailStatus} IS NULL`
        )
      );

    // Calculate success rate
    const completedConsultationsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultations)
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.status, "completed")
        )
      );

    const totalEmails = Number(totalEmailsResult[0]?.count || 0);
    const totalTasks = Number(totalTasksResult[0]?.count || 0);
    const pendingApprovals = Number(pendingApprovalsResult[0]?.count || 0);
    const missingEmails = Number(missingEmailsResult[0]?.count || 0);
    const completedConsultations = Number(completedConsultationsResult[0]?.count || 0);

    const successRate = completedConsultations > 0 
      ? Math.round((totalEmails / completedConsultations) * 100) 
      : 0;

    res.json({
      totalEmails,
      totalTasks,
      pendingApprovals,
      missingEmails,
      successRate
    });
  } catch (error: any) {
    console.error("Error fetching Echo stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get consultations without summary email
// Also excludes consultations that have already been handled via the old emailDrafts system
router.get("/pending-consultations", async (req: any, res) => {
  try {
    const consultantId = req.user.id;

    // First get all completed consultations that appear to need email
    const allPendingConsultations = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        scheduledAt: consultations.scheduledAt,
        duration: consultations.duration,
        notes: consultations.notes,
        transcript: consultations.transcript,
        fathomShareLink: consultations.fathomShareLink,
        summaryEmailStatus: consultations.summaryEmailStatus,
        client: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email
        }
      })
      .from(consultations)
      .leftJoin(users, eq(consultations.clientId, users.id))
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.status, "completed"),
          sql`${consultations.summaryEmailStatus} = 'missing' OR ${consultations.summaryEmailStatus} IS NULL`
        )
      )
      .orderBy(desc(consultations.scheduledAt));

    // Check which of these already have email drafts sent/approved in the old system
    const consultationIds = allPendingConsultations.map(c => c.id);
    
    if (consultationIds.length > 0) {
      // Find consultations that already have sent/approved/pending drafts in emailDrafts table
      const existingDrafts = await db
        .select({ consultationId: emailDrafts.consultationId })
        .from(emailDrafts)
        .where(
          and(
            sql`${emailDrafts.consultationId} IN (${sql.join(consultationIds.map(id => sql`${id}`), sql`, `)})`,
            eq(emailDrafts.emailType, "consultation_summary"),
            sql`${emailDrafts.status} IN ('sent', 'approved', 'pending')`
          )
        );
      
      const handledConsultationIds = new Set(existingDrafts.map(d => d.consultationId));
      
      // Filter out already handled consultations
      const trulyPendingConsultations = allPendingConsultations.filter(
        c => !handledConsultationIds.has(c.id)
      );
      
      res.json(trulyPendingConsultations);
    } else {
      res.json(allPendingConsultations);
    }
  } catch (error: any) {
    console.error("Error fetching pending consultations:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get draft emails awaiting approval
router.get("/draft-emails", async (req: any, res) => {
  try {
    const consultantId = req.user.id;

    const draftEmails = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        scheduledAt: consultations.scheduledAt,
        summaryEmailDraft: consultations.summaryEmailDraft,
        summaryEmailGeneratedAt: consultations.summaryEmailGeneratedAt,
        client: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email
        }
      })
      .from(consultations)
      .leftJoin(users, eq(consultations.clientId, users.id))
      .where(
        and(
          eq(consultations.consultantId, consultantId),
          eq(consultations.summaryEmailStatus, "draft")
        )
      )
      .orderBy(desc(consultations.scheduledAt));

    // Get draft tasks for each consultation
    const result = await Promise.all(
      draftEmails.map(async (email) => {
        const draftTasks = await db
          .select()
          .from(consultationTasks)
          .where(
            and(
              eq(consultationTasks.consultationId, email.id),
              eq(consultationTasks.source, "echo_extracted"),
              eq(consultationTasks.draftStatus, "draft")
            )
          );

        return {
          ...email,
          draftTasks
        };
      })
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching draft emails:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate email for a consultation
router.post("/generate-email", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId, additionalNotes } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Get consultation with client info
    const consultation = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        scheduledAt: consultations.scheduledAt,
        notes: consultations.notes,
        transcript: consultations.transcript,
        fathomShareLink: consultations.fathomShareLink,
        googleMeetLink: consultations.googleMeetLink,
        summaryEmailStatus: consultations.summaryEmailStatus
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    const consultationData = consultation[0];

    // Check if transcript exists
    if (!consultationData.transcript) {
      return res.status(400).json({ error: "Transcript is required to generate email. Please add the Fathom transcript first." });
    }

    // Get client info
    const client = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email
      })
      .from(users)
      .where(eq(users.id, consultationData.clientId))
      .limit(1);

    // Get consultant info
    const consultant = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(eq(users.id, consultantId))
      .limit(1);

    if (!client[0] || !consultant[0]) {
      return res.status(404).json({ error: "Client or consultant not found" });
    }

    // Generate email using existing function
    const generatedEmail = await generateConsultationSummaryEmail({
      consultationId: consultationData.id,
      clientId: consultationData.clientId,
      consultantId: consultantId,
      clientName: `${client[0].firstName} ${client[0].lastName}`,
      consultantName: `${consultant[0].firstName} ${consultant[0].lastName}`,
      consultationDate: new Date(consultationData.scheduledAt),
      fathomTranscript: consultationData.transcript,
      fathomShareLink: consultationData.fathomShareLink || undefined,
      googleMeetLink: consultationData.googleMeetLink || undefined,
      consultationNotes: consultationData.notes || undefined,
      additionalNotes: additionalNotes || undefined
    });

    // Parse extracted tasks from email actions (if available)
    const extractedTasks = (generatedEmail.actions || []).map((action: any) => ({
      title: action.action,
      description: null,
      dueDate: action.expectedCompletion || null,
      priority: "medium" as const,
      category: action.type === "exercise" ? "exercise" as const : "follow-up" as const
    }));

    // Save draft to consultation
    await db
      .update(consultations)
      .set({
        summaryEmailStatus: "draft",
        summaryEmailDraft: {
          subject: generatedEmail.subject,
          body: generatedEmail.body,
          extractedTasks
        },
        summaryEmailGeneratedAt: new Date()
      })
      .where(eq(consultations.id, consultationId));

    // Delete any existing echo_extracted draft tasks for this consultation
    await db
      .delete(consultationTasks)
      .where(
        and(
          eq(consultationTasks.consultationId, consultationId),
          eq(consultationTasks.source, "echo_extracted"),
          eq(consultationTasks.draftStatus, "draft")
        )
      );

    // Create draft tasks
    for (const task of extractedTasks) {
      await db.insert(consultationTasks).values({
        consultationId,
        clientId: consultationData.clientId,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        priority: task.priority,
        category: task.category,
        source: "echo_extracted",
        draftStatus: "draft"
      });
    }

    res.json({
      success: true,
      email: {
        subject: generatedEmail.subject,
        body: generatedEmail.body,
        preview: generatedEmail.preview
      },
      extractedTasks
    });
  } catch (error: any) {
    console.error("Error generating Echo email:", error);
    res.status(500).json({ error: error.message });
  }
});

// Approve and send email
router.post("/approve-and-send", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Get consultation with draft
    const consultation = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        summaryEmailDraft: consultations.summaryEmailDraft,
        summaryEmailStatus: consultations.summaryEmailStatus
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId),
          eq(consultations.summaryEmailStatus, "draft")
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const consultationData = consultation[0];
    const draft = consultationData.summaryEmailDraft as any;

    if (!draft) {
      return res.status(400).json({ error: "No draft email found" });
    }

    // Get client email
    const client = await db
      .select({
        email: users.email,
        firstName: users.firstName
      })
      .from(users)
      .where(eq(users.id, consultationData.clientId))
      .limit(1);

    if (!client[0]) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Send email using storage utility
    try {
      await storage.sendConsultationSummaryEmail(
        consultantId,
        client[0].email,
        draft.subject,
        draft.body
      );
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);
      return res.status(500).json({ error: `Failed to send email: ${emailError.message}` });
    }

    // Update consultation status
    const now = new Date();
    await db
      .update(consultations)
      .set({
        summaryEmailStatus: "sent",
        summaryEmail: draft.body,
        summaryEmailApprovedAt: now,
        summaryEmailSentAt: now
      })
      .where(eq(consultations.id, consultationId));

    // Activate all draft tasks
    await db
      .update(consultationTasks)
      .set({
        draftStatus: "active",
        activatedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(consultationTasks.consultationId, consultationId),
          eq(consultationTasks.source, "echo_extracted"),
          eq(consultationTasks.draftStatus, "draft")
        )
      );

    res.json({ success: true, message: "Email sent and tasks activated" });
  } catch (error: any) {
    console.error("Error approving and sending email:", error);
    res.status(500).json({ error: error.message });
  }
});

// Save for AI only (don't send email)
router.post("/save-for-ai", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Get consultation with draft
    const consultation = await db
      .select({
        id: consultations.id,
        summaryEmailDraft: consultations.summaryEmailDraft,
        summaryEmailStatus: consultations.summaryEmailStatus
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId),
          eq(consultations.summaryEmailStatus, "draft")
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = consultation[0].summaryEmailDraft as any;

    if (!draft) {
      return res.status(400).json({ error: "No draft email found" });
    }

    // Update consultation status (approved but not sent)
    const now = new Date();
    await db
      .update(consultations)
      .set({
        summaryEmailStatus: "approved",
        summaryEmail: draft.body,
        summaryEmailApprovedAt: now
      })
      .where(eq(consultations.id, consultationId));

    // Activate all draft tasks
    await db
      .update(consultationTasks)
      .set({
        draftStatus: "active",
        activatedAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(consultationTasks.consultationId, consultationId),
          eq(consultationTasks.source, "echo_extracted"),
          eq(consultationTasks.draftStatus, "draft")
        )
      );

    res.json({ success: true, message: "Email saved for AI context and tasks activated" });
  } catch (error: any) {
    console.error("Error saving for AI:", error);
    res.status(500).json({ error: error.message });
  }
});

// Discard draft
router.post("/discard", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Verify ownership
    const consultation = await db
      .select({ id: consultations.id })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    // Update consultation status - set to 'missing' so it reappears for regeneration
    await db
      .update(consultations)
      .set({
        summaryEmailStatus: "missing",
        summaryEmailDraft: null
      })
      .where(eq(consultations.id, consultationId));

    // Discard all draft tasks
    await db
      .update(consultationTasks)
      .set({
        draftStatus: "discarded",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(consultationTasks.consultationId, consultationId),
          eq(consultationTasks.source, "echo_extracted"),
          eq(consultationTasks.draftStatus, "draft")
        )
      );

    res.json({ success: true, message: "Draft discarded" });
  } catch (error: any) {
    console.error("Error discarding draft:", error);
    res.status(500).json({ error: error.message });
  }
});

// Extract tasks from transcript (without generating email)
router.post("/extract-tasks", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId, transcript } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }
    if (!transcript || transcript.trim().length < 50) {
      return res.status(400).json({ error: "Transcript is required (minimum 50 characters)" });
    }

    // Verify ownership
    const consultation = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId)
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    // Get client info
    const client = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName
      })
      .from(users)
      .where(eq(users.id, consultation[0].clientId))
      .limit(1);

    const clientName = client[0] ? `${client[0].firstName} ${client[0].lastName}` : "Cliente";

    // Use AI to extract tasks from transcript
    const { getAIProvider, getModelWithThinking } = await import("../ai/provider-factory");
    const aiProvider = await getAIProvider(consultantId, consultantId);

    const prompt = `Analizza la seguente trascrizione di una consulenza e identifica TUTTE le azioni concrete, compiti e follow-up discussi.

TRASCRIZIONE:
${transcript}

CLIENTE: ${clientName}

Estrai ogni azione menzionata, inclusi:
- Esercizi assegnati al cliente
- Documenti da inviare o ricevere
- Scadenze e appuntamenti
- Attività di follow-up
- Compiti per il consulente
- Qualsiasi altro impegno discusso

Rispondi SOLO con un JSON valido nel seguente formato:
{
  "tasks": [
    {
      "title": "Titolo breve dell'azione",
      "description": "Descrizione dettagliata se necessaria",
      "dueDate": "YYYY-MM-DD o null se non specificata",
      "priority": "high" | "medium" | "low",
      "category": "exercise" | "follow-up" | "document" | "meeting"
    }
  ]
}

Se non ci sono azioni concrete nella trascrizione, rispondi con {"tasks": []}`;

    const { model } = getModelWithThinking(aiProvider.metadata.name);
    const result = await aiProvider.client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000
      }
    });

    const responseText = result.response.text() || "";
    
    // Parse JSON response
    let extractedTasks: Array<{
      title: string;
      description: string | null;
      dueDate: string | null;
      priority: "high" | "medium" | "low";
      category: "exercise" | "follow-up" | "document" | "meeting";
    }> = [];

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          extractedTasks = parsed.tasks.map((task: any) => ({
            title: task.title || "Task senza titolo",
            description: task.description || null,
            dueDate: task.dueDate || null,
            priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
            category: ["exercise", "follow-up", "document", "meeting"].includes(task.category) ? task.category : "follow-up"
          }));
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI response for tasks:", parseError);
    }

    res.json({
      success: true,
      tasks: extractedTasks,
      message: `Estratti ${extractedTasks.length} task dalla trascrizione`
    });
  } catch (error: any) {
    console.error("Error extracting tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update draft email/tasks
router.put("/update-draft", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId, subject, body, tasks } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Verify ownership
    const consultation = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        summaryEmailDraft: consultations.summaryEmailDraft
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId),
          eq(consultations.summaryEmailStatus, "draft")
        )
      )
      .limit(1);

    if (!consultation[0]) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const currentDraft = consultation[0].summaryEmailDraft as any || {};

    // Update draft
    const updatedDraft = {
      subject: subject || currentDraft.subject,
      body: body || currentDraft.body,
      extractedTasks: tasks || currentDraft.extractedTasks || []
    };

    await db
      .update(consultations)
      .set({
        summaryEmailDraft: updatedDraft
      })
      .where(eq(consultations.id, consultationId));

    // If tasks were updated, sync them
    if (tasks) {
      // Delete existing draft tasks
      await db
        .delete(consultationTasks)
        .where(
          and(
            eq(consultationTasks.consultationId, consultationId),
            eq(consultationTasks.source, "echo_extracted"),
            eq(consultationTasks.draftStatus, "draft")
          )
        );

      // Create new draft tasks
      for (const task of tasks) {
        await db.insert(consultationTasks).values({
          consultationId,
          clientId: consultation[0].clientId,
          title: task.title,
          description: task.description || null,
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          priority: task.priority || "medium",
          category: task.category || "follow-up",
          source: "echo_extracted",
          draftStatus: "draft"
        });
      }
    }

    res.json({ success: true, draft: updatedDraft });
  } catch (error: any) {
    console.error("Error updating draft:", error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate email
router.post("/regenerate", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    const { consultationId, additionalNotes } = req.body;

    if (!consultationId) {
      return res.status(400).json({ error: "consultationId is required" });
    }

    // Delete existing draft tasks
    await db
      .delete(consultationTasks)
      .where(
        and(
          eq(consultationTasks.consultationId, consultationId),
          eq(consultationTasks.source, "echo_extracted"),
          eq(consultationTasks.draftStatus, "draft")
        )
      );

    // Reset status to missing (will be set to draft by generate-email)
    await db
      .update(consultations)
      .set({
        summaryEmailStatus: "missing",
        summaryEmailDraft: null
      })
      .where(
        and(
          eq(consultations.id, consultationId),
          eq(consultations.consultantId, consultantId)
        )
      );

    // Forward to generate-email endpoint logic
    req.body = { consultationId, additionalNotes };
    
    // Call the generate endpoint handler
    const generateHandler = router.stack.find(
      (layer: any) => layer.route?.path === "/generate-email" && layer.route?.methods?.post
    );
    
    if (generateHandler) {
      // Re-use generate-email logic by forwarding
      return res.redirect(307, `/api/echo/generate-email`);
    }

    res.status(500).json({ error: "Generate handler not found" });
  } catch (error: any) {
    console.error("Error regenerating email:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get consultations with email status (for calendar view)
router.get("/consultations-email-status", async (req: any, res) => {
  try {
    const consultantId = req.user.id;

    const consultationsWithStatus = await db
      .select({
        id: consultations.id,
        clientId: consultations.clientId,
        scheduledAt: consultations.scheduledAt,
        duration: consultations.duration,
        status: consultations.status,
        summaryEmailStatus: consultations.summaryEmailStatus,
        client: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName
        }
      })
      .from(consultations)
      .leftJoin(users, eq(consultations.clientId, users.id))
      .where(eq(consultations.consultantId, consultantId))
      .orderBy(desc(consultations.scheduledAt));

    res.json(consultationsWithStatus);
  } catch (error: any) {
    console.error("Error fetching consultations email status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Sync historical email status from emailDrafts table to consultations table
// This fixes consultations where emails were sent via the old system but summaryEmailStatus wasn't updated
router.post("/sync-historical-emails", async (req: any, res) => {
  try {
    const consultantId = req.user.id;
    console.log(`🔄 [ECHO SYNC] Starting historical email sync for consultant ${consultantId}`);

    // Find all sent/approved consultation_summary drafts that have a consultationId
    const sentDrafts = await db
      .select({
        consultationId: emailDrafts.consultationId,
        status: emailDrafts.status,
        sentAt: emailDrafts.sentAt,
        approvedAt: emailDrafts.approvedAt
      })
      .from(emailDrafts)
      .where(
        and(
          eq(emailDrafts.consultantId, consultantId),
          eq(emailDrafts.emailType, "consultation_summary"),
          sql`${emailDrafts.status} IN ('sent', 'approved')`,
          sql`${emailDrafts.consultationId} IS NOT NULL`
        )
      );

    console.log(`🔄 [ECHO SYNC] Found ${sentDrafts.length} sent/approved drafts to sync`);

    let synced = 0;
    let alreadySynced = 0;

    for (const draft of sentDrafts) {
      if (!draft.consultationId) continue;

      // Check if consultation already has status
      const [consultation] = await db
        .select({ summaryEmailStatus: consultations.summaryEmailStatus })
        .from(consultations)
        .where(eq(consultations.id, draft.consultationId));

      if (consultation && (!consultation.summaryEmailStatus || consultation.summaryEmailStatus === 'missing')) {
        // Update consultation with correct status
        const newStatus = draft.status === 'sent' ? 'sent' : 'approved';
        const updateData: any = { summaryEmailStatus: newStatus };
        
        if (draft.status === 'sent' && draft.sentAt) {
          updateData.summaryEmailSentAt = draft.sentAt;
        } else if (draft.status === 'approved' && draft.approvedAt) {
          updateData.summaryEmailApprovedAt = draft.approvedAt;
        }

        await db
          .update(consultations)
          .set(updateData)
          .where(eq(consultations.id, draft.consultationId));
        
        synced++;
        console.log(`✅ [ECHO SYNC] Synced consultation ${draft.consultationId} to status: ${newStatus}`);
      } else {
        alreadySynced++;
      }
    }

    console.log(`🔄 [ECHO SYNC] Sync complete: ${synced} updated, ${alreadySynced} already synced`);

    res.json({
      success: true,
      message: `Sincronizzazione completata: ${synced} consulenze aggiornate, ${alreadySynced} già sincronizzate`,
      synced,
      alreadySynced,
      total: sentDrafts.length
    });
  } catch (error: any) {
    console.error("Error syncing historical emails:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate bullet-point summary from full transcript using AI
router.post("/generate-summary-from-transcript", async (req: any, res) => {
  try {
    const { fullTranscript, clientName } = req.body;
    const consultantId = req.user.id;

    if (!fullTranscript || typeof fullTranscript !== 'string') {
      return res.status(400).json({ error: "Trascrizione mancante" });
    }

    console.log(`🔄 [ECHO] Generating summary from transcript for consultant ${consultantId}`);

    // Get consultant's AI configuration
    const { getAIProvider, getModelWithThinking } = await import("../ai/provider-factory");
    const aiProvider = await getAIProvider(consultantId, consultantId);
    
    if (!aiProvider) {
      return res.status(500).json({ error: "Configurazione AI non disponibile" });
    }

    // Get the appropriate model name
    const { model } = getModelWithThinking(aiProvider.metadata.name);

    const prompt = `Sei un assistente professionale per consulenze finanziarie. Analizza la seguente trascrizione di una consulenza con il cliente ${clientName || 'il cliente'} e crea un riassunto strutturato.

TRASCRIZIONE:
${fullTranscript}

---

Crea un riassunto professionale in formato bullet-point che includa:

## Punti Chiave Discussi
• [Elenca i principali argomenti trattati]

## Situazione Attuale
• [Descrivi brevemente la situazione finanziaria/personale emersa]

## Obiettivi del Cliente
• [Elenca gli obiettivi menzionati]

## Azioni Concordate
• [Elenca le azioni specifiche da fare]

## Note Importanti
• [Eventuali note aggiuntive rilevanti]

Rispondi SOLO con il riassunto formattato in italiano, senza commenti aggiuntivi.`;

    const result = await aiProvider.client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2000,
      },
    });

    const summary = result.response.text();
    
    if (!summary) {
      throw new Error("Nessun riassunto generato");
    }

    console.log(`✅ [ECHO] Summary generated successfully (${summary.length} chars)`);

    res.json({ summary });
  } catch (error: any) {
    console.error("Error generating summary from transcript:", error);
    res.status(500).json({ error: error.message || "Errore nella generazione del riassunto" });
  }
});

export default router;
