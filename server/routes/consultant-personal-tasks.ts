import { Router } from "express";
import { db } from "../db";
import { consultantPersonalTasks } from "../../shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKeyForClassifier, GEMINI_3_MODEL } from "../ai/provider-factory";

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

router.post("/consultant-personal-tasks/ai-generate", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { input, mode } = req.body;
    if (!input?.trim()) return res.status(400).json({ success: false, error: "Input richiesto" });

    const apiKey = await getGeminiApiKeyForClassifier();
    if (!apiKey) return res.status(500).json({ success: false, error: "AI non configurata" });

    const today = new Date();
    const romeDate = today.toLocaleDateString("it-IT", { timeZone: "Europe/Rome", weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const existingTasks = await db.select().from(consultantPersonalTasks)
      .where(and(
        eq(consultantPersonalTasks.consultantId, req.user!.id),
        eq(consultantPersonalTasks.completed, false)
      ))
      .orderBy(desc(consultantPersonalTasks.createdAt))
      .limit(20);

    const existingTasksSummary = existingTasks.length > 0
      ? existingTasks.map(t => `- [${t.priority}] ${t.title} (${t.category})${t.dueDate ? ` scadenza: ${new Date(t.dueDate).toLocaleDateString('it-IT')}` : ''}`).join('\n')
      : 'Nessuna task esistente';

    const systemPrompt = `Sei un assistente AI per un consulente finanziario. Il tuo compito è generare task concrete e actionable a partire dall'input dell'utente.

DATA ATTUALE: ${romeDate}

TASK PENDENTI DEL CONSULENTE (per evitare duplicati e per contesto):
${existingTasksSummary}

REGOLE:
1. Genera task CONCRETE e SPECIFICHE, non vaghe
2. Assegna date realistiche partendo da oggi. Distribuisci le task nei prossimi giorni/settimane in modo ragionevole
3. Assegna priorità (low/medium/high/urgent) basandoti sull'urgenza e importanza
4. Assegna una categoria tra: business, marketing, operations, learning, finance, other
5. Se l'input contiene più idee, genera una task per ogni idea
6. Se l'input è vago, interpretalo al meglio e genera task concrete
7. NON duplicare task che già esistono
8. Ogni task deve avere un titolo chiaro e una descrizione con i dettagli operativi
9. Le date devono essere in formato ISO (YYYY-MM-DD)

RISPONDI SOLO con un array JSON valido (senza markdown, senza backtick), dove ogni elemento ha:
{
  "title": "string - titolo chiaro e conciso",
  "description": "string - dettagli operativi su cosa fare",
  "dueDate": "string - data ISO YYYY-MM-DD o null",
  "priority": "low|medium|high|urgent",
  "category": "business|marketing|operations|learning|finance|other"
}`;

    const modeInstruction = mode === "schedule"
      ? "L'utente ti ha dato una LISTA di cose da fare. Il tuo compito è schedulare queste attività con date appropriate, distribuendole in modo ragionevole nel tempo. Assegna date specifiche."
      : mode === "ideas"
      ? "L'utente ti sta condividendo delle IDEE. Trasformale in task concrete e actionable con obiettivi misurabili. Aggiungi sotto-step se necessario."
      : "L'utente ti sta dando un TESTO LIBERO. Analizzalo e estrai tutte le attività concrete che riesci a individuare. Sii proattivo e suggerisci anche task complementari se utili.";

    const genAI = new GoogleGenAI({ apiKey });
    
    let tasks: any[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await genAI.models.generateContent({
          model: GEMINI_3_MODEL,
          contents: [
            { role: "user", parts: [{ text: `${modeInstruction}\n\nInput dell'utente:\n${input.trim()}` }] },
          ],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 1024 },
          },
        });

        const responseText = result.text?.trim() || "";
        const cleaned = responseText.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
        
        const bracketStart = cleaned.indexOf('[');
        const bracketEnd = cleaned.lastIndexOf(']');
        const jsonStr = bracketStart >= 0 && bracketEnd > bracketStart 
          ? cleaned.substring(bracketStart, bracketEnd + 1) 
          : cleaned;
        
        const parsed = JSON.parse(jsonStr);
        tasks = Array.isArray(parsed) ? parsed : [parsed];
        break;
      } catch (parseError) {
        console.error(`[AI-TASKS] Attempt ${attempt + 1} failed:`, parseError);
        if (attempt === 1) {
          return res.status(500).json({ success: false, error: "L'AI non ha generato un formato valido. Riprova con un testo più chiaro." });
        }
      }
    }

    const validCategories = ["business", "marketing", "operations", "learning", "finance", "other"];
    const validPriorities = ["low", "medium", "high", "urgent"];
    const sanitizedTasks = tasks.map((t: any) => ({
      title: String(t.title || "").trim().slice(0, 200),
      description: t.description ? String(t.description).trim().slice(0, 1000) : null,
      dueDate: t.dueDate && !isNaN(Date.parse(t.dueDate)) ? t.dueDate : null,
      priority: validPriorities.includes(t.priority) ? t.priority : "medium",
      category: validCategories.includes(t.category) ? t.category : "other",
    })).filter((t: any) => t.title.length > 0);

    res.json({ success: true, data: sanitizedTasks });
  } catch (error: any) {
    console.error("[AI-TASKS] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
