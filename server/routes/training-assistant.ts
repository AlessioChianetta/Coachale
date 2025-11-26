/**
 * Training Assistant Routes
 * Handles file uploads, AI analysis, and improvement suggestions
 */

import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole, requireAnyRole, type AuthRequest } from '../middleware/auth';
import { GeminiTrainingAnalyzer } from '../ai/gemini-training-analyzer';
import { db } from '../db';
import { trainingAnalysisHistory, clientSalesAgents, salesConversationTraining } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = express.Router();

/**
 * GET /api/training/conversations/:agentId
 * Get all conversations for an agent with AI analysis status
 */
router.get(
  '/conversations/:agentId',
  authenticateToken,
  requireRole('client'),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      
      // Verify agent exists and belongs to this client
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);
      
      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }
      
      if (agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get all conversations for this agent
      // NOTE: Using .select() without params due to Drizzle issue with nullable JSONB fields
      const rawConversations = await db.select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.agentId, agentId))
        .orderBy(desc(salesConversationTraining.createdAt));
      
      // Map to camelCase (Drizzle returns snake_case when using .select() without params)
      const conversations = rawConversations.map(conv => ({
        id: conv.id,
        conversationId: conv.conversation_id, // snake_case from DB
        prospectName: conv.prospect_name,     // snake_case from DB
        prospectEmail: conv.prospect_email,   // snake_case from DB
        currentPhase: conv.current_phase,     // snake_case from DB
        createdAt: conv.created_at,           // snake_case from DB
        aiAnalysisResult: conv.ai_analysis_result, // snake_case from DB
      }));
      
      return res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ message: 'Failed to fetch conversations' });
    }
  }
);

// Configure multer for file uploads (in-memory storage)
const uploadStorage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    // Accept only PDF, DOCX, TXT
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(pdf|docx|txt)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    }
  }
});

/**
 * POST /api/training/analyze
 * Enhanced Training Analysis with flexible modes:
 * - Mode: "all_conversations" (default) - Analyzes all conversations with optional files
 * - Mode: "single_conversation" - Analyzes specific conversation with optional files
 * 
 * Body params:
 * - agentId: string (required)
 * - mode: "all_conversations" | "single_conversation" (default: "all_conversations")
 * - conversationId: string (required if mode = "single_conversation")
 * - files: File[] (optional - can be empty array)
 */
router.post(
  '/analyze',
  authenticateToken,
  requireRole('client'),
  uploadMiddleware.array('files', 5), // Max 5 files at once (OPTIONAL now)
  async (req: AuthRequest, res) => {
    try {
      const { agentId, mode = 'all_conversations', conversationId } = req.body;
      const files = req.files as Express.Multer.File[] || [];
      
      if (!agentId) {
        return res.status(400).json({ message: 'Agent ID is required' });
      }
      
      // Validate mode-specific requirements
      if (mode === 'single_conversation' && !conversationId) {
        return res.status(400).json({ message: 'Conversation ID is required for single conversation mode' });
      }
      
      if (mode === 'all_conversations' && files.length === 0) {
        return res.status(400).json({ message: 'At least one file is required for all conversations mode' });
      }
      
      // Verify agent exists and belongs to this client
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);
      
      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }
      
      if (agent[0].clientId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied - agent does not belong to this client' });
      }
      
      console.log(`\n📤 [TRAINING ANALYSIS] Mode: ${mode}, Agent: ${agentId}`);
      if (mode === 'single_conversation') {
        console.log(`   - Conversation: ${conversationId}`);
      }
      console.log(`   - Files: ${files.length}`);
      files.forEach(f => console.log(`     • ${f.originalname} (${f.mimetype}, ${f.size} bytes)`));
      
      // Initialize analyzer (use CLIENT's Vertex credentials, consultant ID for fallback)
      const analyzer = new GeminiTrainingAnalyzer(agent[0].clientId, agent[0].consultantId);
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MODE 1: SINGLE CONVERSATION ANALYSIS
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      if (mode === 'single_conversation') {
        console.log(`🎯 [SINGLE CONVERSATION] Starting analysis for ${conversationId}...`);
        
        // Analyze single conversation (with optional files)
        const result = await analyzer.analyzeSingleConversation(
          conversationId,
          files.length > 0 ? files.map(f => ({
            filename: f.originalname,
            buffer: f.buffer,
            mimetype: f.mimetype
          })) : undefined
        );
        
        // Save result to salesConversationTraining.aiAnalysisResult
        const analyzedAt = new Date().toISOString();
        const aiAnalysisResult = {
          insights: result.insights.map(text => ({ category: 'general', text, priority: 'medium' })),
          problems: result.problems,
          suggestions: result.suggestions.map(text => ({ category: 'general', text, impact: 'medium' })),
          strengths: result.strengths.map(text => ({ category: 'general', text })),
          score: result.score,
          analyzedAt,
          analyzedFiles: files.map(f => f.originalname)
        };
        
        await db.update(salesConversationTraining)
          .set({ 
            aiAnalysisResult: aiAnalysisResult as any,
            updatedAt: new Date()
          })
          .where(eq(salesConversationTraining.id, conversationId));
        
        console.log(`✅ [SINGLE CONVERSATION] Analysis saved to conversation ${conversationId}`);
        
        return res.json({
          success: true,
          mode: 'single_conversation',
          conversationId,
          analyzedAt,
          analyzedFiles: files.map(f => f.originalname), // Always include this field
          ...result
        });
      }
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // MODE 2: ALL CONVERSATIONS ANALYSIS (Original behavior)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log(`📚 [ALL CONVERSATIONS] Starting analysis for agent ${agentId}...`);
      
      const result = await analyzer.analyzeTrainingFiles(
        agentId,
        files.map(f => ({
          filename: f.originalname,
          buffer: f.buffer,
          mimetype: f.mimetype
        }))
      );
      
      // Save to trainingAnalysisHistory
      const [savedAnalysis] = await db.insert(trainingAnalysisHistory).values({
        id: `analysis_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        agentId: agentId,
        consultantId: agent[0].consultantId,
        analyzedFiles: result.analyzedFiles,
        improvements: result.improvements as any,
        conversationsAnalyzed: result.conversationsAnalyzed,
        totalImprovements: result.totalImprovements,
        criticalImprovements: result.criticalImprovements,
        highImprovements: result.highImprovements,
        analyzedAt: result.analyzedAt,
        createdAt: new Date()
      }).returning();
      
      console.log(`✅ [ALL CONVERSATIONS] Analysis saved with ID ${savedAnalysis.id}`);
      
      res.json({
        success: true,
        mode: 'all_conversations',
        analysisId: savedAnalysis.id,
        ...result
      });
      
    } catch (error: any) {
      console.error('❌ [TRAINING ANALYSIS] Error:', error.message);
      res.status(500).json({ 
        message: error.message || 'Failed to analyze training data'
      });
    }
  }
);

/**
 * GET /api/training/history/:agentId
 * Get analysis history for an agent
 */
router.get(
  '/history/:agentId',
  authenticateToken,
  requireAnyRole(['consultant', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      
      // Verify agent exists and belongs to this consultant
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);
      
      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }
      
      if (agent[0].consultantId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Get history
      const history = await db.select()
        .from(trainingAnalysisHistory)
        .where(eq(trainingAnalysisHistory.agentId, agentId))
        .orderBy(desc(trainingAnalysisHistory.createdAt))
        .limit(20);
      
      res.json({ history });
      
    } catch (error: any) {
      console.error('❌ [TRAINING HISTORY] Error:', error.message);
      res.status(500).json({ message: 'Failed to fetch analysis history' });
    }
  }
);

/**
 * GET /api/training/analysis/:analysisId
 * Get specific analysis details
 */
router.get(
  '/analysis/:analysisId',
  authenticateToken,
  requireAnyRole(['consultant', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const { analysisId } = req.params;
      
      const [analysis] = await db.select()
        .from(trainingAnalysisHistory)
        .where(eq(trainingAnalysisHistory.id, analysisId))
        .limit(1);
      
      if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      if (analysis.consultantId !== req.user?.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(analysis);
      
    } catch (error: any) {
      console.error('❌ [TRAINING ANALYSIS] Error:', error.message);
      res.status(500).json({ message: 'Failed to fetch analysis' });
    }
  }
);

/**
 * GET /api/training/analytics/:agentId
 * Get aggregated analytics for all 4 advanced training tabs
 * Accessible by both clients and consultants
 */
router.get(
  '/analytics/:agentId',
  authenticateToken,
  requireAnyRole(['client', 'consultant', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params;
      
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);
      
      if (!agent[0]) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }
      
      if (req.user?.role === 'client' && agent[0].clientId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      if (req.user?.role === 'consultant' && agent[0].consultantId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Use Drizzle ORM instead of raw SQL to avoid parameter syntax issues
      const conversations = await db.select({
        conversation_id: salesConversationTraining.conversationId,
        current_phase: salesConversationTraining.currentPhase,
        phases_reached: salesConversationTraining.phasesReached,
        phase_activations: salesConversationTraining.phaseActivations,
        ladder_activations: salesConversationTraining.ladderActivations,
        ai_reasoning: salesConversationTraining.aiReasoning,
        full_transcript: salesConversationTraining.fullTranscript,
        contextual_responses: salesConversationTraining.contextualResponses,
        objections_encountered: salesConversationTraining.objectionsEncountered,
        checkpoints_completed: salesConversationTraining.checkpointsCompleted,
        created_at: salesConversationTraining.createdAt,
        completion_rate: salesConversationTraining.completionRate,
        total_duration: salesConversationTraining.totalDuration,
      })
      .from(salesConversationTraining)
      .where(eq(salesConversationTraining.agentId, agentId))
      .orderBy(desc(salesConversationTraining.createdAt))
      .limit(100);
      
      const phaseFlow = {
        totalConversations: conversations.length,
        phaseCompletionRates: {} as Record<string, number>,
        averagePhaseTransitionTime: {} as Record<string, number>
      };
      
      const ladderAnalytics = {
        totalActivations: 0,
        averageDepth: 0,
        activationsByPhase: {} as Record<string, number>,
        depthDistribution: {
          depth_1: 0,
          depth_2: 0,
          depth_3: 0,
          depth_4: 0,
          depth_5_plus: 0
        }
      };
      
      const objectionHandling = {
        totalObjections: 0,
        objections: [] as Array<{
          objection: string;
          frequency: number;
          resolved: number;
          notResolved: number;
          resolutionRate: number;
        }>
      };
      
      const aiReasoning = {
        totalReasoningEntries: 0,
        reasoningByType: {} as Record<string, number>,
        contextualResponses: [] as Array<{
          timestamp: string;
          conversationId: string;
          question: string;
          response: string;
          phase: string;
        }>
      };
      
      const phaseCounters: Record<string, number> = {};
      const phaseReachedCount: Record<string, number> = {};
      const objectionMap = new Map<string, { resolved: number; notResolved: number }>();
      
      for (const conv of conversations) {
        const currentPhase = conv.current_phase;
        const phasesReached = conv.phases_reached || [];
        const ladderActivations = conv.ladder_activations || [];
        const aiReasoningData = conv.ai_reasoning || [];
        const contextualResponsesData = conv.contextual_responses || [];
        const objectionsEncountered = conv.objections_encountered || [];
        
        if (Array.isArray(phasesReached)) {
          phasesReached.forEach((phase: string) => {
            phaseReachedCount[phase] = (phaseReachedCount[phase] || 0) + 1;
          });
        }
        
        if (currentPhase) {
          phaseCounters[currentPhase] = 
            (phaseCounters[currentPhase] || 0) + 1;
        }
        
        if (Array.isArray(ladderActivations)) {
          ladderAnalytics.totalActivations += ladderActivations.length;
          
          ladderActivations.forEach((activation: any) => {
            const phase = activation.phase || 'unknown';
            ladderAnalytics.activationsByPhase[phase] = 
              (ladderAnalytics.activationsByPhase[phase] || 0) + 1;
            
            const level = activation.level || 1;
            if (level === 1) ladderAnalytics.depthDistribution.depth_1++;
            else if (level === 2) ladderAnalytics.depthDistribution.depth_2++;
            else if (level === 3) ladderAnalytics.depthDistribution.depth_3++;
            else if (level === 4) ladderAnalytics.depthDistribution.depth_4++;
            else ladderAnalytics.depthDistribution.depth_5_plus++;
          });
        }
        
        if (Array.isArray(aiReasoningData)) {
          aiReasoning.totalReasoningEntries += aiReasoningData.length;
          
          aiReasoningData.forEach((reasoning: any) => {
            const type = reasoning.type || 'unknown';
            aiReasoning.reasoningByType[type] = (aiReasoning.reasoningByType[type] || 0) + 1;
            
            if (type === 'objection_handling' && reasoning.objection) {
              const objectionText = reasoning.objection.toLowerCase();
              const existing = objectionMap.get(objectionText) || { resolved: 0, notResolved: 0 };
              
              if (reasoning.resolution === 'resolved') {
                existing.resolved++;
              } else {
                existing.notResolved++;
              }
              objectionMap.set(objectionText, existing);
            }
          });
        }
        
        if (Array.isArray(objectionsEncountered)) {
          objectionsEncountered.forEach((objection: any) => {
            const objectionText = (objection.objection || objection.text || '').toLowerCase();
            if (objectionText) {
              const existing = objectionMap.get(objectionText) || { resolved: 0, notResolved: 0 };
              
              if (objection.resolved === true || objection.status === 'resolved') {
                existing.resolved++;
              } else {
                existing.notResolved++;
              }
              objectionMap.set(objectionText, existing);
            }
          });
        }
        
        if (Array.isArray(contextualResponsesData)) {
          contextualResponsesData.forEach((ctx: any) => {
            aiReasoning.contextualResponses.push({
              timestamp: ctx.timestamp || conv.created_at,
              conversationId: conv.conversation_id,
              question: ctx.question || '',
              response: ctx.response || '',
              phase: ctx.phase || 'unknown'
            });
          });
        }
      }
      
      for (const [phase, count] of Object.entries(phaseReachedCount)) {
        phaseFlow.phaseCompletionRates[phase] = 
          conversations.length > 0 ? (count / conversations.length) * 100 : 0;
      }
      
      if (conversations.length > 0 && ladderAnalytics.totalActivations > 0) {
        ladderAnalytics.averageDepth = ladderAnalytics.totalActivations / conversations.length;
      }
      
      objectionMap.forEach((stats, objection) => {
        const total = stats.resolved + stats.notResolved;
        objectionHandling.objections.push({
          objection,
          frequency: total,
          resolved: stats.resolved,
          notResolved: stats.notResolved,
          resolutionRate: total > 0 ? (stats.resolved / total) * 100 : 0
        });
      });
      
      objectionHandling.objections.sort((a, b) => b.frequency - a.frequency);
      objectionHandling.totalObjections = objectionHandling.objections.reduce(
        (sum, obj) => sum + obj.frequency, 
        0
      );
      
      aiReasoning.contextualResponses.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      res.json({
        success: true,
        data: {
          phaseFlow,
          ladderAnalytics,
          objectionHandling,
          aiReasoning
        }
      });
      
    } catch (error: any) {
      console.error('❌ [TRAINING ANALYTICS] Error:', error.message);
      res.status(500).json({ message: 'Failed to fetch training analytics' });
    }
  }
);

/**
 * POST /api/training/analyze-conversation/:conversationId
 * Analyze a SINGLE conversation with Gemini 2.5 Pro
 * Returns insights, problems, suggestions based ONLY on conversation data (no external documents)
 */
router.post(
  '/analyze-conversation/:conversationId',
  authenticateToken,
  requireAnyRole(['client', 'consultant', 'admin']),
  async (req: AuthRequest, res) => {
    try {
      console.log(`🎯 [CONVERSATION ANALYSIS] Received request for conversation ${req.params.conversationId}`);
      console.log(`👤 [CONVERSATION ANALYSIS] User: ${req.user?.id}, Role: ${req.user?.role}`);
      
      const { conversationId } = req.params;
      
      // Load conversation to verify access
      console.log(`🔍 [CONVERSATION ANALYSIS] Searching for conversation ID: ${conversationId} in salesConversationTraining table...`);
      
      const [conversation] = await db.select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.id, conversationId))
        .limit(1);
      
      if (!conversation) {
        console.warn(`❌ [CONVERSATION ANALYSIS] Conversation ${conversationId} NOT FOUND in database`);
        console.warn(`📊 [CONVERSATION ANALYSIS] This might be because:`);
        console.warn(`   1. The conversation hasn't been saved to salesConversationTraining yet (async delay)`);
        console.warn(`   2. The conversationId is incorrect`);
        console.warn(`   3. The record was deleted`);
        console.warn(`💡 [CONVERSATION ANALYSIS] Frontend should retry after a short delay`);
        return res.status(404).json({ 
          message: 'Conversation not found in database',
          conversationId,
          hint: 'The conversation may not be saved yet. Please try again in a few seconds.'
        });
      }
      
      console.log(`✅ [CONVERSATION ANALYSIS] Conversation found: ${conversation.prospectName || 'Unknown'}`);
      console.log(`📊 [CONVERSATION ANALYSIS] Conversation details: Phase=${conversation.currentPhase}, Messages=${conversation.fullTranscript?.length || 0}`);
      
      // Get agent to verify access
      const [agent] = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, conversation.agentId))
        .limit(1);
      
      if (!agent) {
        return res.status(404).json({ message: 'Sales agent not found' });
      }
      
      // Check authorization
      if (req.user?.role === 'client' && agent.clientId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      if (req.user?.role === 'consultant' && agent.consultantId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      console.log(`\n🎯 [CONVERSATION ANALYSIS] Analyzing conversation ${conversationId}`);
      
      // Initialize analyzer (use CLIENT's Vertex credentials, consultant ID for fallback)
      const analyzer = new GeminiTrainingAnalyzer(agent.clientId, agent.consultantId);
      
      // Analyze single conversation
      const result = await analyzer.analyzeSingleConversation(conversationId);
      
      console.log(`✅ [CONVERSATION ANALYSIS] Analysis complete for ${conversationId}`);
      
      res.json({
        success: true,
        conversationId,
        ...result
      });
      
    } catch (error: any) {
      console.error('❌ [CONVERSATION ANALYSIS] Error:', error.message);
      res.status(500).json({ 
        message: error.message || 'Failed to analyze conversation'
      });
    }
  }
);

export default router;
