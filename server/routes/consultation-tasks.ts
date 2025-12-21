import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";
import { storage } from "../storage";
import { insertConsultationTaskSchema, updateConsultationTaskSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// POST /api/consultations/:id/tasks - Create task for a consultation (consultant only)
router.post("/consultations/:id/tasks", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const consultationId = req.params.id;
    
    // Verify consultation exists and consultant owns it
    const consultation = await storage.getConsultation(consultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    if (consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // Validate and create task
    const validatedData = insertConsultationTaskSchema.parse({
      ...req.body,
      consultationId,
      clientId: consultation.clientId,
    });
    
    const task = await storage.createConsultationTask(validatedData);
    
    res.status(201).json({ 
      success: true, 
      data: task 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to create task" 
    });
  }
});

// GET /api/consultations/:id/tasks - List tasks for a consultation (client and consultant)
router.get("/consultations/:id/tasks", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const consultationId = req.params.id;
    
    // Verify consultation exists
    const consultation = await storage.getConsultation(consultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    // Check if user has access to this consultation
    const hasAccess = consultation.clientId === req.user!.id || 
                     (req.user!.role === "consultant" && consultation.consultantId === req.user!.id);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // Get tasks for this consultation
    const tasks = await storage.getConsultationTasks(consultationId);
    
    res.json({ 
      success: true, 
      data: tasks 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch tasks" 
    });
  }
});

// GET /api/consultations/tasks/my - List all tasks for logged-in client
router.get("/consultations/tasks/my", authenticateToken, requireRole("client"), async (req: AuthRequest, res) => {
  try {
    const { completed, priority, category } = req.query;
    
    // Build filters
    const filters: any = {};
    if (completed !== undefined) {
      filters.completed = completed === 'true';
    }
    if (priority) {
      filters.priority = priority as string;
    }
    if (category) {
      filters.category = category as string;
    }
    
    const tasks = await storage.getClientTasks(req.user!.id, filters);
    
    res.json({ 
      success: true, 
      data: tasks 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch client tasks" 
    });
  }
});

// PUT /api/consultation-tasks/:taskId - Update a task (consultant only)
router.put("/consultation-tasks/:taskId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.taskId;
    
    // Get the task to verify it exists and check ownership
    const task = await storage.getConsultationTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    // Verify consultant owns the consultation
    const consultation = await storage.getConsultation(task.consultationId);
    if (!consultation || consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // Validate and update
    const validatedData = updateConsultationTaskSchema.parse(req.body);
    const updatedTask = await storage.updateConsultationTask(taskId, validatedData);
    
    if (!updatedTask) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: updatedTask 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to update task" 
    });
  }
});

// DELETE /api/consultation-tasks/:taskId - Delete a task (consultant only)
router.delete("/consultation-tasks/:taskId", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.taskId;
    
    // Get the task to verify it exists and check ownership
    const task = await storage.getConsultationTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    // Verify consultant owns the consultation
    const consultation = await storage.getConsultation(task.consultationId);
    if (!consultation || consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    const deleted = await storage.deleteConsultationTask(taskId);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: { message: "Task deleted successfully" } 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to delete task" 
    });
  }
});

// POST /api/consultation-tasks/:taskId/complete - Complete a task (client can complete their own tasks, consultant can complete all)
router.post("/consultation-tasks/:taskId/complete", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.taskId;
    
    // Get the task to verify it exists and check ownership
    const task = await storage.getConsultationTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    // Get consultation to verify access
    const consultation = await storage.getConsultation(task.consultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    // Check access: client can complete their own tasks, consultant can complete all their consultations' tasks
    const hasAccess = task.clientId === req.user!.id || 
                     (req.user!.role === "consultant" && consultation.consultantId === req.user!.id);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    const completedTask = await storage.completeConsultationTask(taskId);
    
    if (!completedTask) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: completedTask 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to complete task" 
    });
  }
});

// GET /api/consultation-tasks - Get tasks for a specific client (consultant only)
// Supports optional consultationId filter to show only tasks for a specific consultation
// Excludes draft and discarded tasks by default (only shows active or null draftStatus)
router.get("/consultation-tasks", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, consultationId, completed, priority, category, includeDrafts } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: "clientId query parameter is required" 
      });
    }
    
    // Build filters
    const filters: any = {};
    if (completed !== undefined) {
      filters.completed = completed === 'true';
    }
    if (priority) {
      filters.priority = priority as string;
    }
    if (category) {
      filters.category = category as string;
    }
    if (consultationId) {
      filters.consultationId = consultationId as string;
    }
    // By default, exclude draft and discarded tasks unless specifically requested
    filters.excludeDraftStatus = includeDrafts !== 'true';
    
    const tasks = await storage.getClientTasks(clientId as string, filters);
    
    res.json({ 
      success: true, 
      data: tasks 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch tasks" 
    });
  }
});

// POST /api/consultation-tasks - Create a new task (consultant only)
router.post("/consultation-tasks", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { clientId, consultationId, ...taskData } = req.body;
    
    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: "clientId is required" 
      });
    }
    
    let finalConsultationId = consultationId;
    
    // If no consultationId provided, find the most recent consultation for this client-consultant pair
    if (!finalConsultationId) {
      const consultations = await storage.getConsultationsByClient(clientId);
      const consultantConsultations = consultations.filter(c => c.consultantId === req.user!.id);
      
      if (consultantConsultations.length > 0) {
        // Use the most recent consultation
        finalConsultationId = consultantConsultations[0].id;
      } else {
        return res.status(400).json({ 
          success: false, 
          error: "No consultation found for this client. Please create a consultation first or provide a consultationId." 
        });
      }
    }
    
    // Verify consultation exists and consultant owns it
    const consultation = await storage.getConsultation(finalConsultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    if (consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // Validate and create task
    const validatedData = insertConsultationTaskSchema.parse({
      ...taskData,
      consultationId: finalConsultationId,
      clientId: consultation.clientId,
    });
    
    const task = await storage.createConsultationTask(validatedData);
    
    res.status(201).json({ 
      success: true, 
      data: task 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to create task" 
    });
  }
});

// PATCH /api/consultation-tasks/:id - Update a task (consultant and client for completion)
router.patch("/consultation-tasks/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;
    
    // Get the task to verify it exists and check ownership
    const task = await storage.getConsultationTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    // Get consultation to verify access
    const consultation = await storage.getConsultation(task.consultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    // Check access
    const isConsultant = req.user!.role === "consultant" && consultation.consultantId === req.user!.id;
    const isClient = task.clientId === req.user!.id;
    
    if (!isConsultant && !isClient) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // If client, only allow updating 'completed' field
    let updateData = req.body;
    if (isClient && !isConsultant) {
      // Client can only toggle completion
      if ('completed' in req.body) {
        updateData = { 
          completed: req.body.completed,
          completedAt: req.body.completed ? new Date() : null
        };
      } else {
        return res.status(403).json({ 
          success: false, 
          error: "Clients can only update completion status" 
        });
      }
    }
    
    // Validate and update
    const validatedData = updateConsultationTaskSchema.parse(updateData);
    const updatedTask = await storage.updateConsultationTask(taskId, validatedData);
    
    if (!updatedTask) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: updatedTask 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to update task" 
    });
  }
});

// DELETE /api/consultation-tasks/:id - Delete a task (consultant only) - Alias for /:taskId
router.delete("/consultation-tasks/:id", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const taskId = req.params.id;
    
    // Get the task to verify it exists and check ownership
    const task = await storage.getConsultationTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    // Verify consultant owns the consultation
    const consultation = await storage.getConsultation(task.consultationId);
    if (!consultation || consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    const deleted = await storage.deleteConsultationTask(taskId);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: "Task not found" 
      });
    }
    
    res.json({ 
      success: true, 
      data: { message: "Task deleted successfully" } 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to delete task" 
    });
  }
});

// GET /api/consultation-tasks/consultant - Get all tasks for the logged-in consultant across all clients
router.get("/consultation-tasks/consultant", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { completed, priority, category, clientId, consultationId } = req.query;
    
    // Get all tasks for this consultant
    const allTasks = await storage.getConsultationTasksByConsultant(req.user!.id);
    
    // Apply filters
    let filteredTasks = allTasks;
    
    if (completed !== undefined) {
      filteredTasks = filteredTasks.filter((t: any) => t.completed === (completed === 'true'));
    }
    
    if (priority) {
      filteredTasks = filteredTasks.filter((t: any) => t.priority === priority);
    }
    
    if (category) {
      filteredTasks = filteredTasks.filter((t: any) => t.category === category);
    }
    
    if (clientId) {
      filteredTasks = filteredTasks.filter((t: any) => t.clientId === clientId);
    }
    
    if (consultationId) {
      filteredTasks = filteredTasks.filter((t: any) => t.consultationId === consultationId);
    }
    
    res.json({ 
      success: true, 
      data: filteredTasks 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch consultant tasks" 
    });
  }
});

// POST /api/consultation-tasks/batch - Create multiple tasks at once (consultant only)
router.post("/consultation-tasks/batch", authenticateToken, requireRole("consultant"), async (req: AuthRequest, res) => {
  try {
    const { consultationId, tasks } = req.body;
    
    if (!consultationId) {
      return res.status(400).json({ 
        success: false, 
        error: "consultationId is required" 
      });
    }
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "tasks must be a non-empty array" 
      });
    }
    
    // Verify consultation exists and consultant owns it
    const consultation = await storage.getConsultation(consultationId);
    if (!consultation) {
      return res.status(404).json({ 
        success: false, 
        error: "Consultation not found" 
      });
    }
    
    if (consultation.consultantId !== req.user!.id) {
      return res.status(403).json({ 
        success: false, 
        error: "Access denied" 
      });
    }
    
    // CRITICAL: Use consultation.clientId from database, not from request payload
    // This prevents cross-client data exposure and maintains referential integrity
    const clientId = consultation.clientId;
    
    // Create all tasks
    const createdTasks = [];
    for (const taskData of tasks) {
      // SECURITY: Strip clientId AND consultationId from payload to prevent override
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { clientId: _ignoredClientId, consultationId: _ignoredConsultationId, ...safeTaskData } = taskData;
      
      const validatedData = insertConsultationTaskSchema.parse({
        ...safeTaskData,
        consultationId, // Override from DB, placed after spread to prevent override
        clientId, // Override from DB, placed after spread to prevent override
      });
      
      const task = await storage.createConsultationTask(validatedData);
      createdTasks.push(task);
    }
    
    res.status(201).json({ 
      success: true, 
      data: createdTasks 
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to create tasks" 
    });
  }
});

export default router;
