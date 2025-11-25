/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🤖 GEMINI 2.5 PRO TRAINING ASSISTANT
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Analyzes training documents (PDF, DOCX, TXT) and sales conversations
 * to suggest script improvements automatically using Gemini 2.5 Pro
 * 
 * Features:
 * - Multi-format document parsing (PDF, DOCX, TXT)
 * - Conversation analysis from database
 * - AI-powered gap detection
 * - Prioritized improvement suggestions
 * - Impact estimation
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import fs from "fs/promises";
import { db } from "../db";
import { salesConversationTraining, clientSalesAgents } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { getAIProvider } from "./provider-factory";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TrainingFile {
  filename: string;
  buffer: Buffer;
  mimetype: string;
}

export interface TrainingImprovement {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'urgency' | 'social_proof' | 'objection_handling' | 'ladder' | 'checkpoint' | 'tone' | 'structure' | 'other';
  title: string;
  problem: string;
  evidence: string[];
  currentScript: string | null;
  suggestedScript: string;
  reasoning: string;
  estimatedImpact: number; // % conversion increase
  effort: 'low' | 'medium' | 'high';
  sourceFile: string;
}

export interface TrainingAnalysisResult {
  improvements: TrainingImprovement[];
  analyzedFiles: Array<{
    filename: string;
    status: 'success' | 'error';
    error?: string;
  }>;
  conversationsAnalyzed: number;
  totalImprovements: number;
  criticalImprovements: number;
  highImprovements: number;
  analyzedAt: Date;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN CLASS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class GeminiTrainingAnalyzer {
  private clientId: string;
  private consultantId: string;

  constructor(clientId: string, consultantId: string) {
    this.clientId = clientId;
    this.consultantId = consultantId;
  }

  /**
   * Main analysis entry point
   * Analyzes training files + recent conversations to suggest improvements
   */
  async analyzeTrainingFiles(
    agentId: string,
    files: TrainingFile[]
  ): Promise<TrainingAnalysisResult> {
    console.log(`\n╔${'═'.repeat(78)}╗`);
    console.log(`║ 🤖 GEMINI TRAINING ASSISTANT - ANALYSIS START${' '.repeat(31)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ Agent ID: ${agentId.padEnd(66)} ║`);
    console.log(`║ Files to analyze: ${files.length.toString().padEnd(58)} ║`);
    console.log(`╚${'═'.repeat(78)}╝\n`);

    const result: TrainingAnalysisResult = {
      improvements: [],
      analyzedFiles: [],
      conversationsAnalyzed: 0,
      totalImprovements: 0,
      criticalImprovements: 0,
      highImprovements: 0,
      analyzedAt: new Date()
    };

    try {
      // STEP 1: Parse all files
      console.log(`\n┌─ STEP 1: Parsing ${files.length} training files...`);
      const parsedFiles: Array<{ filename: string; text: string }> = [];

      for (const file of files) {
        try {
          console.log(`│  📄 Parsing ${file.filename}...`);
          const text = await this.parseFile(file);
          parsedFiles.push({ filename: file.filename, text });
          result.analyzedFiles.push({ filename: file.filename, status: 'success' });
          console.log(`│  ✅ Parsed ${file.filename} (${text.length} chars)`);
        } catch (error: any) {
          console.error(`│  ❌ Failed to parse ${file.filename}:`, error.message);
          result.analyzedFiles.push({ 
            filename: file.filename, 
            status: 'error', 
            error: error.message 
          });
        }
      }
      console.log(`└─ STEP 1: Parsed ${parsedFiles.length}/${files.length} files\n`);

      if (parsedFiles.length === 0) {
        throw new Error('No files could be parsed successfully');
      }

      // STEP 2: Load agent's current script and recent conversations
      console.log(`┌─ STEP 2: Loading sales agent data...`);
      const agent = await db.select()
        .from(clientSalesAgents)
        .where(eq(clientSalesAgents.id, agentId))
        .limit(1);

      if (!agent[0]) {
        throw new Error(`Sales agent ${agentId} not found`);
      }

      const currentScript = agent[0].systemPrompt || agent[0].customPrompt || '';
      console.log(`│  ✅ Loaded current script (${currentScript.length} chars)`);

      // Get recent conversations for performance analysis
      const conversations = await db.select()
        .from(salesConversationTraining)
        .where(eq(salesConversationTraining.agentId, agentId))
        .orderBy(desc(salesConversationTraining.createdAt))
        .limit(20);

      result.conversationsAnalyzed = conversations.length;
      console.log(`│  ✅ Loaded ${conversations.length} recent conversations`);
      console.log(`└─ STEP 2: Complete\n`);

      // STEP 3: Analyze with Gemini 2.5 Pro
      console.log(`┌─ STEP 3: Analyzing with Gemini 2.5 Pro...`);
      const improvements = await this.analyzeWithGemini(
        parsedFiles,
        currentScript,
        conversations,
        agent[0].displayName
      );
      console.log(`│  ✅ Generated ${improvements.length} improvement suggestions`);
      console.log(`└─ STEP 3: Complete\n`);

      // STEP 4: Prioritize and structure results
      result.improvements = this.prioritizeImprovements(improvements);
      result.totalImprovements = result.improvements.length;
      result.criticalImprovements = result.improvements.filter(i => i.priority === 'critical').length;
      result.highImprovements = result.improvements.filter(i => i.priority === 'high').length;

      console.log(`\n╔${'═'.repeat(78)}╗`);
      console.log(`║ ✅ ANALYSIS COMPLETE${' '.repeat(57)} ║`);
      console.log(`╠${'═'.repeat(78)}╣`);
      console.log(`║ Total improvements: ${result.totalImprovements.toString().padEnd(56)} ║`);
      console.log(`║ Critical: ${result.criticalImprovements.toString().padEnd(67)} ║`);
      console.log(`║ High: ${result.highImprovements.toString().padEnd(71)} ║`);
      console.log(`╚${'═'.repeat(78)}╝\n`);

      return result;

    } catch (error: any) {
      console.error(`\n❌ [TRAINING ANALYZER] Analysis failed:`, error.message);
      throw error;
    }
  }

  /**
   * Parse file based on mimetype
   */
  private async parseFile(file: TrainingFile): Promise<string> {
    const { buffer, mimetype, filename } = file;

    // PDF
    if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      const data = await pdfParse(buffer);
      return data.text;
    }

    // DOCX
    if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        filename.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // TXT
    if (mimetype === 'text/plain' || filename.endsWith('.txt')) {
      return buffer.toString('utf-8');
    }

    throw new Error(`Unsupported file type: ${mimetype}`);
  }

  /**
   * Analyze with Gemini 2.5 Pro
   * Uses provider factory to get appropriate AI client
   */
  private async analyzeWithGemini(
    parsedFiles: Array<{ filename: string; text: string }>,
    currentScript: string,
    conversations: any[],
    agentName: string
  ): Promise<TrainingImprovement[]> {

    // Get AI provider (use CLIENT's Vertex credentials, not consultant's)
    console.log(`🔍 Getting AI provider for client ${this.clientId} (consultant: ${this.consultantId})...`);
    const provider = await getAIProvider(this.clientId, this.consultantId);

    if (!provider || !provider.client) {
      throw new Error('Failed to initialize AI provider for training analysis');
    }

    console.log(`✅ AI provider obtained: ${provider.metadata.name} (source: ${provider.source})`);

    // Prepare training content
    const trainingContent = parsedFiles.map(f => 
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📄 FILE: ${f.filename}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      f.text
    ).join('\n\n');

    // Prepare conversation summaries
    const conversationSummaries = conversations.slice(0, 10).map((c, idx) => ({
      index: idx + 1,
      phase: c.currentPhase,
      completionRate: c.completionRate,
      ladderDepth: c.ladderActivations?.length || 0,
      checkpointsCompleted: c.checkpointsCompleted?.length || 0,
      transcript: c.fullTranscript?.slice(0, 5) || [] // First 5 messages
    }));

    // Build comprehensive prompt
    const prompt = this.buildAnalysisPrompt(
      trainingContent,
      currentScript,
      conversationSummaries,
      agentName
    );

    console.log(`🔮 Sending ${prompt.length} chars to Gemini...`);

    // Call Gemini using provider factory client
    const response = await provider.client.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3, // Low temperature for consistent, factual analysis
        maxOutputTokens: 8000,
      }
    });

    console.log(`✅ Gemini response received`);

    const resultText = response.response.text();
    console.log(`✅ Received ${resultText.length} chars from Gemini`);

    // Parse JSON response
    return this.parseGeminiResponse(resultText, parsedFiles.map(f => f.filename));
  }

  /**
   * Build analysis prompt for Gemini
   */
  private buildAnalysisPrompt(
    trainingContent: string,
    currentScript: string,
    conversations: any[],
    agentName: string
  ): string {
    return `Sei un esperto di sales training. Analizza i documenti di training forniti insieme allo script di vendita corrente e alle performance recenti per suggerire miglioramenti concreti.

📚 DOCUMENTI DI TRAINING:
${trainingContent}

📋 SCRIPT DI VENDITA CORRENTE (Sales Agent "${agentName}"):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${currentScript.substring(0, 15000)} ${currentScript.length > 15000 ? '...(truncated)' : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 PERFORMANCE RECENTI (${conversations.length} conversazioni):
${JSON.stringify(conversations, null, 2)}

🎯 IL TUO COMPITO:

1. Confronta i documenti di training con lo script corrente
2. Analizza le performance per identificare pattern di successo/fallimento
3. Identifica 8-12 gap concreti tra best practices (nei documenti) e script attuale
4. Per ogni gap, suggerisci il fix specifico con impatto stimato

RESTITUISCI RISPOSTA IN FORMATO JSON (solo JSON valido, senza markdown):

{
  "improvements": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "category": "urgency" | "social_proof" | "objection_handling" | "ladder" | "checkpoint" | "tone" | "structure" | "other",
      "title": "Titolo breve del problema (max 60 char)",
      "problem": "Descrizione del problema attuale nello script",
      "evidence": [
        "Quote esatta dal documento di training che mostra la best practice",
        "Quote dallo script corrente che mostra il gap"
      ],
      "currentScript": "Parte dello script attuale che va modificata (se applicabile)",
      "suggestedScript": "Script migliorato suggerito (concreto e pronto all'uso)",
      "reasoning": "Perché questo miglioramento è importante (2-3 frasi)",
      "estimatedImpact": numero da 1 a 30 (% aumento conversion rate stimato),
      "effort": "low" | "medium" | "high",
      "sourceFile": "nome del file da cui viene il suggerimento"
    }
  ]
}

REGOLE CRITICHE:
- Priorità CRITICAL solo per gap che causano perdita di clienti (es: mancanza urgency in closing)
- Priorità HIGH per gap con impatto >10% conversion
- Impact realistico: urgency +15%, social proof +8%, ladder +12%, ecc.
- Effort: low=modifica prompt, medium=nuova sezione, high=ristrutturazione
- Suggerimenti CONCRETI e ACTIONABLE - non generici
- Usa evidenze DIRETTE dai documenti forniti

RESTITUISCI SOLO IL JSON, NIENTE ALTRO.`;
  }

  /**
   * Parse Gemini JSON response
   */
  private parseGeminiResponse(text: string, sourceFiles: string[]): TrainingImprovement[] {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      // Try to find the complete JSON object using bracket counting
      let braceCount = 0;
      let startIndex = -1;
      let endIndex = -1;

      for (let i = 0; i < cleanText.length; i++) {
        if (cleanText[i] === '{') {
          if (braceCount === 0) {
            startIndex = i;
          }
          braceCount++;
        } else if (cleanText[i] === '}') {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            endIndex = i;
            break;
          }
        }
      }

      if (startIndex === -1 || endIndex === -1) {
        console.error('❌ No complete JSON object found in response');
        console.error('Response text (first 1000 chars):', cleanText.substring(0, 1000));
        throw new Error('No complete JSON object found in Gemini response');
      }

      const jsonStr = cleanText.substring(startIndex, endIndex + 1);
      console.log(`📝 Extracted JSON (${jsonStr.length} chars)`);

      const parsed = JSON.parse(jsonStr);

      if (!parsed.improvements || !Array.isArray(parsed.improvements)) {
        console.error('❌ Invalid response structure - improvements not found or not an array');
        console.error('Parsed keys:', Object.keys(parsed).join(', '));
        throw new Error('Invalid response structure - improvements missing or invalid');
      }

      // Add unique IDs
      const improvements = parsed.improvements.map((imp: any, index: number) => ({
        ...imp,
        id: `imp_${Date.now()}_${index}`
      }));

      console.log(`✅ Successfully parsed ${improvements.length} improvements`);
      return improvements;

    } catch (error: any) {
      console.error('❌ Failed to parse Gemini response:', error.message);
      console.error('Response text (first 1000 chars):', text.substring(0, 1000));
      console.error('Response text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Prioritize improvements by priority, impact, and effort
   */
  private prioritizeImprovements(improvements: TrainingImprovement[]): TrainingImprovement[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return improvements.sort((a, b) => {
      // Sort by priority first
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Then by estimated impact (higher first)
      if (a.estimatedImpact !== b.estimatedImpact) {
        return b.estimatedImpact - a.estimatedImpact;
      }

      // Finally by effort (lower first)
      const effortOrder = { low: 0, medium: 1, high: 2 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });
  }

  /**
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 🎯 SINGLE CONVERSATION ANALYZER (ENHANCED)
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 
   * Analyzes a single conversation data with OPTIONAL training files
   * Returns insights, problems detected, and suggestions
   * 
   * @param conversationId - ID of the conversation to analyze
   * @param files - Optional training files to include in analysis
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   */
  async analyzeSingleConversation(
    conversationId: string,
    files?: TrainingFile[]
  ): Promise<{
    insights: string[];
    problems: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      evidence: string;
    }>;
    suggestions: string[];
    strengths: string[];
    score: {
      overall: number;
      phaseProgression: number;
      questionQuality: number;
      ladderEffectiveness: number;
      checkpointCompletion: number;
    };
  }> {
    console.log(`\n╔${'═'.repeat(78)}╗`);
    console.log(`║ 🎯 SINGLE CONVERSATION ANALYSIS START${' '.repeat(40)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ Conversation ID: ${conversationId.substring(0, 8).padEnd(60)} ║`);
    console.log(`║ With files: ${(files && files.length > 0 ? `Yes (${files.length})` : 'No').padEnd(67)} ║`);
    console.log(`╚${'═'.repeat(78)}╝\n`);

    // STEP 1: Load conversation data
    console.log(`┌─ STEP 1: Loading conversation data...`);
    const conversations = await db.select()
      .from(salesConversationTraining)
      .where(eq(salesConversationTraining.id, conversationId))
      .limit(1);

    if (!conversations[0]) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const conversation = conversations[0];
    console.log(`│  ✅ Loaded conversation: ${conversation.prospectName || 'Unknown'}`);
    console.log(`│  📊 Phase: ${conversation.currentPhase}, Completion: ${Math.round((conversation.completionRate || 0) * 100)}%`);
    console.log(`│  💬 Transcript: ${conversation.fullTranscript?.length || 0} messages`);
    console.log(`└─ STEP 1: Complete\n`);

    // STEP 1.5: Parse training files if provided
    let parsedFiles: Array<{ filename: string; text: string }> = [];
    if (files && files.length > 0) {
      console.log(`┌─ STEP 1.5: Parsing ${files.length} training files...`);
      for (const file of files) {
        try {
          console.log(`│  📄 Parsing ${file.filename}...`);
          const text = await this.parseFile(file);
          parsedFiles.push({ filename: file.filename, text });
          console.log(`│  ✅ Parsed ${file.filename} (${text.length} chars)`);
        } catch (error: any) {
          console.error(`│  ❌ Failed to parse ${file.filename}:`, error.message);
        }
      }
      console.log(`└─ STEP 1.5: Parsed ${parsedFiles.length}/${files.length} files\n`);
    }

    // STEP 2: Call Gemini 2.5 Pro for analysis
    console.log(`┌─ STEP 2: Analyzing with Gemini 2.5 Pro...`);
    const provider = await getAIProvider(this.clientId, this.consultantId);

    if (!provider || !provider.client) {
      throw new Error('Failed to initialize AI provider for conversation analysis');
    }

    console.log(`│  ✅ AI provider: ${provider.metadata.name}`);

    const prompt = this.buildConversationAnalysisPrompt(conversation, parsedFiles);
    // Send request to Gemini with higher token limit
    console.log(`│  🔮 Sending ${prompt.length} chars to Gemini...`);
    
    const result = await provider.client.generateContent({
      model: 'gemini-2.5-pro',
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192
      }
    });

    const responseText = result.response.text();
    console.log(`│  ✅ Received ${responseText.length} chars from Gemini`);
    console.log('└─ STEP 2: Complete\n');

    // Parse response (handle markdown code blocks)
    const analysis = this.parseConversationAnalysisResponse(responseText);

    console.log(`\n╔${'═'.repeat(78)}╗`);
    console.log(`║ ✅ ANALYSIS COMPLETE${' '.repeat(57)} ║`);
    console.log(`╠${'═'.repeat(78)}╣`);
    console.log(`║ Overall Score: ${analysis.score.overall.toString().padEnd(63)} ║`);
    console.log(`║ Insights: ${analysis.insights.length.toString().padEnd(68)} ║`);
    console.log(`║ Problems: ${analysis.problems.length.toString().padEnd(68)} ║`);
    console.log(`║ Suggestions: ${analysis.suggestions.length.toString().padEnd(65)} ║`);
    console.log(`╚${'═'.repeat(78)}╝\n`);

    return analysis;
  }

  /**
   * Build prompt for single conversation analysis (with optional training files)
   */
  private buildConversationAnalysisPrompt(
    conversation: any,
    parsedFiles: Array<{ filename: string; text: string }> = []
  ): string {
    const hasFiles = parsedFiles.length > 0;

    // Build training files section if files are provided
    const trainingFilesSection = hasFiles
      ? `\n\n📚 DOCUMENTI DI TRAINING FORNITI:\n${parsedFiles.map(f => 
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📄 FILE: ${f.filename}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          f.text.substring(0, 5000)
        ).join('\n\n')}\n\n`
      : '';

    const analysisInstruction = hasFiles
      ? `Confronta i documenti di training con le performance della conversazione. Identifica gap tra best practices (nei documenti) e l'esecuzione della conversazione.`
      : `Analizza SOLO i dati della conversazione forniti. NON usare documenti esterni, NON fare riferimento a best practices generiche. BASE LA TUA ANALISI ESCLUSIVAMENTE SU QUESTA CONVERSAZIONE.`;

    return `Sei un esperto coach di vendita. Analizza questa conversazione di training per identificare punti di forza, problemi, e dare suggerimenti concreti.

⚠️ REGOLA CRITICA: ${analysisInstruction}
${trainingFilesSection}
📊 DATI CONVERSAZIONE:

🆔 ID: ${conversation.id}
👤 Prospect: ${conversation.prospectName || 'Unknown'}
📧 Email: ${conversation.prospectEmail || 'N/A'}
⏱️ Durata: ${conversation.totalDuration || 0} secondi
📈 Completion Rate: ${Math.round((conversation.completionRate || 0) * 100)}%

🗺️ PHASE PROGRESSION:
- Fase corrente: ${conversation.currentPhase}
- Fasi raggiunte: ${JSON.stringify(conversation.phasesReached || [])}
- Attivazioni fasi: ${JSON.stringify(conversation.phaseActivations || [], null, 2)}

🎯 CHECKPOINTS:
${JSON.stringify(conversation.checkpointsCompleted || [], null, 2)}

🪜 LADDER ACTIVATIONS:
${JSON.stringify(conversation.ladderActivations || [], null, 2)}

❓ QUESTIONS ASKED:
${JSON.stringify(conversation.questionsAsked || [], null, 2)}

💬 FULL TRANSCRIPT (${conversation.fullTranscript?.length || 0} messages):
${JSON.stringify(conversation.fullTranscript || [], null, 2)}

🎯 IL TUO COMPITO:

1. Analizza la progressione tra le fasi: il sales agent è avanzato in modo logico?
2. Valuta la qualità delle domande: erano specifiche? Hanno generato insights?
3. Valuta l'uso del ladder: ha scavato abbastanza? Le domande erano efficaci?
4. Identifica problemi concreti basati SUI DATI DELLA CONVERSAZIONE
5. Suggerisci miglioramenti specifici per QUESTA performance

RESTITUISCI RISPOSTA IN FORMATO JSON (solo JSON valido, senza markdown):

{
  "insights": [
    "Insight chiave 1 basato sulla conversazione",
    "Insight chiave 2 basato sulla conversazione"
  ],
  "problems": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Titolo breve del problema",
      "description": "Descrizione dettagliata basata sui dati",
      "evidence": "Quote esatta dal transcript o dati specifici"
    }
  ],
  "suggestions": [
    "Suggerimento concreto 1 per migliorare",
    "Suggerimento concreto 2 per migliorare"
  ],
  "strengths": [
    "Punto di forza 1 osservato",
    "Punto di forza 2 osservato"
  ],
  "score": {
    "overall": numero da 0 a 100,
    "phaseProgression": numero da 0 a 100,
    "questionQuality": numero da 0 a 100,
    "ladderEffectiveness": numero da 0 a 100,
    "checkpointCompletion": numero da 0 a 100
  }
}

REGOLE CRITICHE:
- ANALIZZA SOLO QUESTA CONVERSAZIONE - nessun riferimento esterno
- Problemi CRITICAL solo se hanno bloccato la vendita (es: saltato fase discovery)
- Insights devono essere SPECIFICI ai dati forniti, non generici
- Suggerimenti devono essere ACTIONABLE per il prossimo training
- Score realistici basati su: completion rate, fase raggiunta, ladder depth, checkpoints

RESTITUISCI SOLO IL JSON, NIENTE ALTRO.`;
  }

  /**
   * Parse conversation analysis response
   */
  private parseConversationAnalysisResponse(text: string): {
    insights: string[];
    problems: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      evidence: string;
    }>;
    suggestions: string[];
    strengths: string[];
    score: {
      overall: number;
      phaseProgression: number;
      questionQuality: number;
      ladderEffectiveness: number;
      checkpointCompletion: number;
    };
  } {
    try {
      // Strip markdown code blocks if present (```json ... ```)
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Try to find JSON object in response
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('❌ No JSON object found in response');
        console.error('Response text (first 1000 chars):', cleanText.substring(0, 1000));
        throw new Error('No JSON found in Gemini response');
      }

      const jsonStr = jsonMatch[0];

      // Check if JSON is complete (has closing brace)
      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;

      if (openBraces !== closeBraces) {
        console.error('❌ Incomplete JSON object in response');
        console.error('Open braces:', openBraces, 'Close braces:', closeBraces);
        console.error('Response text (first 1000 chars):', cleanText.substring(0, 1000));
        console.error('Response text (last 500 chars):', cleanText.substring(cleanText.length - 500));
        throw new Error('Incomplete JSON object in Gemini response - response was likely truncated due to token limit');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate structure with detailed logging
      const missingFields: string[] = [];
      if (!parsed.insights) missingFields.push('insights');
      if (!parsed.problems) missingFields.push('problems');
      if (!parsed.suggestions) missingFields.push('suggestions');
      if (!parsed.score) missingFields.push('score');
      if (!parsed.strengths) missingFields.push('strengths');

      if (missingFields.length > 0) {
        console.error(`❌ Invalid response structure - missing fields: ${missingFields.join(', ')}`);
        console.error('Parsed keys:', Object.keys(parsed).join(', '));
        throw new Error(`Invalid response structure - missing: ${missingFields.join(', ')}`);
      }

      console.log(`✅ Successfully parsed conversation analysis`);
      return parsed;

    } catch (error: any) {
      console.error('❌ Failed to parse Gemini response:', error.message);
      console.error('Response text (first 1000 chars):', text.substring(0, 1000));
      console.error('Response text (last 500 chars):', text.substring(Math.max(0, text.length - 500)));
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }
}