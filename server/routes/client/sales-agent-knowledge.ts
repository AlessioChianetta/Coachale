import { Router } from 'express';
import { db } from '../../db';
import { clientSalesKnowledge, clientSalesAgents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// GET all knowledge documents for an agent
router.get('/:agentId', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const agent = await db.query.salesAgents.findFirst({
      where: (agents, { and, eq }) => and(
        eq(agents.id, agentId),
        eq(agents.clientId, req.user!.id)
      ),
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const documents = await db
      .select()
      .from(clientSalesKnowledge)
      .where(eq(clientSalesKnowledge.agentId, agentId))
      .orderBy(clientSalesKnowledge.createdAt);

    res.json(documents);
  } catch (error: any) {
    console.error('Error fetching knowledge documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// POST upload new knowledge document
router.post('/:agentId', upload.single('file'), async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { agentId } = req.params;
    const { title, type } = req.body;

    // Verify agent ownership
    const agent = await db.query.salesAgents.findFirst({
      where: (agents, { and, eq }) => and(
        eq(agents.id, agentId),
        eq(agents.clientId, req.user!.id)
      ),
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read file content
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    
    // Delete temporary file
    await fs.unlink(req.file.path);

    // Store in database
    const [document] = await db
      .insert(clientSalesKnowledge)
      .values({
        agentId,
        title: title || req.file.originalname,
        content: fileContent,
        type: type || 'txt',
        filePath: null,
      })
      .returning();

    res.status(201).json(document);
  } catch (error: any) {
    console.error('Error uploading knowledge document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE knowledge document
router.delete('/:agentId/:documentId', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'client') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { agentId, documentId } = req.params;

    // Verify agent ownership
    const agent = await db.query.salesAgents.findFirst({
      where: (agents, { and, eq }) => and(
        eq(agents.id, agentId),
        eq(agents.clientId, req.user!.id)
      ),
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    await db
      .delete(clientSalesKnowledge)
      .where(
        and(
          eq(clientSalesKnowledge.id, documentId),
          eq(clientSalesKnowledge.agentId, agentId)
        )
      );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting knowledge document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
