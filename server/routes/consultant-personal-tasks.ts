import { Router } from "express";
import { db } from "../db";
import { consultantPersonalTasks } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/consultant-personal-tasks", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const tasks = await db.select().from(consultantPersonalTasks)
      .where(eq(consultantPersonalTasks.consultantId, req.user!.id))
      .orderBy(desc(consultantPersonalTasks.createdAt));
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/consultant-personal-tasks", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { title, description, dueDate, priority, category } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, error: "Title is required" });

    const [task] = await db.insert(consultantPersonalTasks).values({
      consultantId: req.user!.id,
      title: title.trim(),
      description: description?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      priority: priority || "medium",
      category: category || "other",
    }).returning();

    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/consultant-personal-tasks/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates: any = { updatedAt: new Date() };

    if (req.body.title !== undefined) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description?.trim() || null;
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    if (req.body.priority !== undefined) updates.priority = req.body.priority;
    if (req.body.category !== undefined) updates.category = req.body.category;

    const [task] = await db.update(consultantPersonalTasks)
      .set(updates)
      .where(and(
        eq(consultantPersonalTasks.id, id),
        eq(consultantPersonalTasks.consultantId, req.user!.id)
      ))
      .returning();

    if (!task) return res.status(404).json({ success: false, error: "Task not found" });
    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/consultant-personal-tasks/:id/toggle", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(consultantPersonalTasks)
      .where(and(
        eq(consultantPersonalTasks.id, id),
        eq(consultantPersonalTasks.consultantId, req.user!.id)
      ))
      .limit(1);

    if (!existing[0]) return res.status(404).json({ success: false, error: "Task not found" });

    const newCompleted = !existing[0].completed;
    const [task] = await db.update(consultantPersonalTasks)
      .set({
        completed: newCompleted,
        completedAt: newCompleted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(consultantPersonalTasks.id, id))
      .returning();

    res.json({ success: true, data: task });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/consultant-personal-tasks/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db.delete(consultantPersonalTasks)
      .where(and(
        eq(consultantPersonalTasks.id, id),
        eq(consultantPersonalTasks.consultantId, req.user!.id)
      ))
      .returning();

    if (!deleted) return res.status(404).json({ success: false, error: "Task not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
