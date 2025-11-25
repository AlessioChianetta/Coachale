import { Router } from 'express';
import { db } from '../db';
import { customLivePrompts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can manage live prompts' });
    }

    const prompts = await db
      .select()
      .from(customLivePrompts)
      .where(eq(customLivePrompts.clientId, req.user.id))
      .orderBy(customLivePrompts.createdAt);

    res.json(prompts);
  } catch (error: any) {
    console.error('Error fetching live prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can create live prompts' });
    }

    const { name, promptText } = req.body;

    if (!name || !promptText) {
      return res.status(400).json({ error: 'Name and prompt text are required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }

    if (promptText.length > 10000) {
      return res.status(400).json({ error: 'Prompt text must be 10000 characters or less' });
    }

    const [newPrompt] = await db
      .insert(customLivePrompts)
      .values({
        clientId: req.user.id,
        name,
        promptText,
      })
      .returning();

    res.status(201).json(newPrompt);
  } catch (error: any) {
    console.error('Error creating live prompt:', error);
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can update live prompts' });
    }

    const { id } = req.params;
    const { name, promptText } = req.body;

    if (!name || !promptText) {
      return res.status(400).json({ error: 'Name and prompt text are required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }

    if (promptText.length > 10000) {
      return res.status(400).json({ error: 'Prompt text must be 10000 characters or less' });
    }

    const [updatedPrompt] = await db
      .update(customLivePrompts)
      .set({
        name,
        promptText,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customLivePrompts.id, id),
          eq(customLivePrompts.clientId, req.user.id)
        )
      )
      .returning();

    if (!updatedPrompt) {
      return res.status(404).json({ error: 'Prompt not found or access denied' });
    }

    res.json(updatedPrompt);
  } catch (error: any) {
    console.error('Error updating live prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ error: 'Only clients can delete live prompts' });
    }

    const { id } = req.params;

    const [deletedPrompt] = await db
      .delete(customLivePrompts)
      .where(
        and(
          eq(customLivePrompts.id, id),
          eq(customLivePrompts.clientId, req.user.id)
        )
      )
      .returning();

    if (!deletedPrompt) {
      return res.status(404).json({ error: 'Prompt not found or access denied' });
    }

    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Error deleting live prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

export default router;
