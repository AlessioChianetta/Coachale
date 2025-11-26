// AI Email Template Generator
// Generates personalized motivational emails using Gemini AI

import { GoogleGenAI } from "@google/genai";
import { buildUserContext, type UserContext } from "../ai-context-builder";
import { buildSystemPrompt } from "../ai-prompts";
import { storage } from "../storage";
import type { AutomatedEmailsLog } from "@shared/schema";
import { db } from "../db";
import { users } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { enhanceEmailTypography } from "../services/email-html-wrapper";
import { getAIProvider, type GeminiClient } from "./provider-factory";

export interface EmailGeneratorInput {
  clientId: string;
  consultantId: string;
  emailTone?: string;
  clientName: string;
  currentState: string;
  idealState: string;
  internalBenefit: string;
  externalBenefit: string;
  mainObstacle: string;
  pastAttempts?: string;
  currentActions?: string;
  futureVision?: string;
  incompleteTasks: Array<{
    title: string;
    dueDate: string | null;
    priority: string;
  }>;
  activeGoals: Array<{
    title: string;
    targetValue: string;
    currentValue: string;
  }>;
  daysUntilNextConsultation: number | null;
  motivationDrivers?: string;
  // Journey-specific fields
  journeyTemplate?: {
    id: string;
    dayOfMonth: number;
    title: string;
    description: string | null;
    emailType: string;
    promptTemplate: string;
    tone: string | null;
    priority: number;
  };
  previousEmailData?: {
    lastEmailSubject?: string;
    lastEmailBody?: string;
    lastEmailActions: Array<{action: string; type: string; expectedCompletion?: string}>;
    actionsCompletedData: {
      completed: boolean;
      details: Array<{action: string; completed: boolean; completedAt?: string}>;
    };
  };
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
  actions?: Array<{action: string; type: string; expectedCompletion?: string}>;
}

// Task 9: Verify if previous email actions were completed
async function verifyPreviousEmailActions(
  clientId: string,
  lastEmailActions: Array<{action: string; type: string; expectedCompletion?: string}>
): Promise<{completed: boolean; details: Array<{action: string; completed: boolean; completedAt?: string}>}> {
  console.log(`🔍 Verifying ${lastEmailActions.length} actions from previous email...`);

  const details: Array<{action: string; completed: boolean; completedAt?: string}> = [];
  let completedCount = 0;

  for (const emailAction of lastEmailActions) {
    const actionType = emailAction.type;
    const actionText = emailAction.action;

    let isCompleted = false;
    let completedAt: string | undefined;

    try {
      if (actionType === 'exercise') {
        // Check if exercise was completed
        const assignments = await storage.getAssignmentsByClient(clientId);
        const completedAssignments = assignments.filter(a => 
          a.status === 'completed' && 
          a.exercise.title.toLowerCase().includes(actionText.toLowerCase())
        );

        if (completedAssignments.length > 0) {
          isCompleted = true;
          completedAt = completedAssignments[0].completedAt?.toISOString();
        }
      } else if (actionType === 'lesson') {
        // Check if lesson was viewed
        const progress = await storage.getUniversityProgressByClient(clientId);
        const viewedLessons = progress.filter(p => 
          p.isCompleted && 
          p.completedAt
        );

        // Simple check - if any lessons completed recently, mark as completed
        if (viewedLessons.length > 0) {
          isCompleted = true;
          completedAt = viewedLessons[viewedLessons.length - 1].completedAt?.toISOString();
        }
      } else if (actionType === 'checkin' || actionType === 'reflection') {
        // Check if daily reflection was done
        const reflections = await storage.getDailyReflectionsByClient(clientId);
        if (reflections.length > 0) {
          isCompleted = true;
          completedAt = reflections[reflections.length - 1].date.toISOString();
        }
      } else if (actionType === 'task') {
        // Check if task was completed
        const tasks = await storage.getClientTasks(clientId);
        const completedTasks = tasks.filter(t => 
          t.completed && 
          t.title.toLowerCase().includes(actionText.toLowerCase())
        );

        if (completedTasks.length > 0) {
          isCompleted = true;
          completedAt = completedTasks[0].completedAt?.toISOString();
        }
      }
    } catch (error) {
      console.error(`Error verifying action "${actionText}":`, error);
    }

    details.push({
      action: actionText,
      completed: isCompleted,
      completedAt: completedAt,
    });

    if (isCompleted) completedCount++;
  }

  const allCompleted = completedCount === lastEmailActions.length && lastEmailActions.length > 0;
  console.log(`✅ Actions verification complete: ${completedCount}/${lastEmailActions.length} completed (${allCompleted ? 'ALL DONE!' : 'some pending'})`);

  return {
    completed: allCompleted,
    details: details,
  };
}

// Get current API key from client's rotation array or fallback to environment
async function getClientApiKey(clientId: string): Promise<{ apiKey: string; shouldRotate: boolean; apiKeysLength: number }> {
  const [client] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);

  if (!client) {
    throw new Error("Client not found");
  }

  const apiKeys = client.geminiApiKeys || [];
  const currentIndex = client.geminiApiKeyIndex || 0;

  // If client has API keys, use the current one in rotation
  if (apiKeys.length > 0) {
    const validIndex = currentIndex % apiKeys.length;
    return {
      apiKey: apiKeys[validIndex],
      shouldRotate: true,
      apiKeysLength: apiKeys.length
    };
  }

  // Otherwise, use the default environment API key (no rotation)
  const defaultKey = process.env.GEMINI_API_KEY || "";
  if (!defaultKey) {
    throw new Error("GEMINI_API_KEY not configured for client and no environment default found");
  }

  return {
    apiKey: defaultKey,
    shouldRotate: false,
    apiKeysLength: 0
  };
}

// Rotate to next API key in the client's array (atomic operation)
async function rotateClientApiKey(clientId: string, apiKeysLength: number): Promise<void> {
  if (apiKeysLength === 0) return; // No rotation needed if no API keys

  // Atomic SQL update: increment the index and wrap around using modulo
  await db.execute(
    sql`UPDATE users 
        SET gemini_api_key_index = (COALESCE(gemini_api_key_index, 0) + 1) % ${apiKeysLength}
        WHERE id = ${clientId}`
  );
}

/**
 * Robust JSON cleaning function with multiple strategies
 * Handles special characters, control characters, and common AI JSON issues
 */
function cleanJsonString(jsonText: string, strategyLevel: number = 1): string {
  let cleaned = jsonText.trim();

  // Strategy 1: Basic cleaning (always applied)
  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\n?/, '').replace(/\n?```$/, '');
  }

  // Strategy 2: Remove control characters (ASCII 0-31 and 127-159)
  if (strategyLevel >= 2) {
    // Remove all control characters except \n, \r, \t which are valid in JSON strings
    cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  }

  // Strategy 3: Fix common AI JSON issues
  if (strategyLevel >= 3) {
    // Remove any trailing commas before closing braces/brackets
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Fix unescaped newlines in string values (but not in code/html blocks)
    // This is tricky - we need to be careful not to break intentional newlines
    cleaned = cleaned.replace(/([^\\])(\r?\n)(?=\s*[,}\]])/g, '$1\\n');
  }

  // Strategy 4: Aggressive fix - escape ALL unescaped quotes in body field
  if (strategyLevel >= 4) {
    console.log('🔧 Applying strategy 4: escape all unescaped quotes in body');

    try {
      // Find the body field start
      const bodyFieldStart = cleaned.indexOf('"body"');
      if (bodyFieldStart === -1) {
        console.log('  ⚠️ No body field found');
        return cleaned;
      }

      // Find where the body value starts (after "body": ")
      const bodyValueStartQuote = cleaned.indexOf('"', bodyFieldStart + 7);
      if (bodyValueStartQuote === -1) return cleaned;

      const bodyValueStart = bodyValueStartQuote + 1;

      // Now find the end of body value
      // Look for the pattern: unescaped quote followed by comma and "preview"
      // We scan looking for ", then whitespace, then "preview"
      let i = bodyValueStart;
      let bodyValueEnd = -1;

      while (i < cleaned.length - 20) {
        // Check if current char is an unescaped quote
        if (cleaned[i] === '"' && cleaned[i - 1] !== '\\') {
          // Look ahead to see if this is followed by comma + whitespace + "preview"
          let j = i + 1;
          // Skip whitespace
          while (j < cleaned.length && (cleaned[j] === ' ' || cleaned[j] === '\n' || cleaned[j] === '\t')) {
            j++;
          }
          // Check for comma
          if (j < cleaned.length && cleaned[j] === ',') {
            j++;
            // Skip more whitespace
            while (j < cleaned.length && (cleaned[j] === ' ' || cleaned[j] === '\n' || cleaned[j] === '\t')) {
              j++;
            }
            // Check for "preview"
            if (cleaned.substring(j, j + 9) === '"preview"') {
              bodyValueEnd = i;
              console.log(`  🔹 Found end of body at position ${i}`);
              break;
            }
          }
        }
        i++;
      }

      if (bodyValueEnd === -1) {
        console.log('  ⚠️ Could not find end of body field');
        return cleaned;
      }

      // Extract the body content
      const bodyContent = cleaned.substring(bodyValueStart, bodyValueEnd);

      // Escape ALL unescaped quotes in the body
      let escapedBody = '';
      for (let j = 0; j < bodyContent.length; j++) {
        const char = bodyContent[j];
        const prevChar = j > 0 ? bodyContent[j - 1] : '';

        if (char === '"' && prevChar !== '\\') {
          escapedBody += '\\"';
        } else {
          escapedBody += char;
        }
      }

      // Rebuild the JSON
      const before = cleaned.substring(0, bodyValueStart);
      const after = cleaned.substring(bodyValueEnd);
      cleaned = before + escapedBody + after;

      const quotesFixed = (escapedBody.match(/\\"/g) || []).length - (bodyContent.match(/\\"/g) || []).length;
      if (quotesFixed > 0) {
        console.log(`  ✅ Escaped ${quotesFixed} unescaped quotes in body field`);
      }
    } catch (e) {
      console.log(`  ⚠️ Strategy 4 error: ${e}`);
    }
  }

  return cleaned;
}

/**
 * Parse email from delimited format (XML-style tags)
 * Much more robust than JSON parsing - no quote escaping issues!
 * Handles both properly closed tags AND unclosed tags (lenient mode)
 */
function parseDelimitedEmail(responseText: string): {
  success: boolean;
  data?: any;
  error?: string;
} {
  try {
    console.log(`📝 Parsing delimited email response...`);

    // Extract subject (with fallback for unclosed tag)
    let subjectMatch = responseText.match(/<SUBJECT>([\s\S]*?)<\/SUBJECT>/);
    if (!subjectMatch) {
      // Try lenient mode: from <SUBJECT> to next tag or reasonable length
      subjectMatch = responseText.match(/<SUBJECT>([\s\S]{1,200}?)(?=<BODY>|<PREVIEW>|$)/);
      if (subjectMatch) {
        console.log(`⚠️ Subject tag not properly closed, using lenient parsing`);
      }
    }
    if (!subjectMatch) {
      return { success: false, error: 'Missing <SUBJECT> tag' };
    }
    const subject = subjectMatch[1].trim();

    // Extract body (with fallback for unclosed tag)
    let bodyMatch = responseText.match(/<BODY>([\s\S]*?)<\/BODY>/);
    if (!bodyMatch) {
      // Try lenient mode: from <BODY> to </PREVIEW> or <PREVIEW> tag
      bodyMatch = responseText.match(/<BODY>([\s\S]*?)(?=<\/PREVIEW>|<PREVIEW>|$)/);
      if (bodyMatch) {
        console.log(`⚠️ Body tag not properly closed, using lenient parsing`);
      }
    }
    if (!bodyMatch) {
      return { success: false, error: 'Missing <BODY> tag' };
    }
    const body = bodyMatch[1].trim();

    // Extract preview (with fallback for unclosed tag)
    let previewMatch = responseText.match(/<PREVIEW>([\s\S]*?)<\/PREVIEW>/);
    if (!previewMatch) {
      // Try lenient mode: from <PREVIEW> to end or reasonable length
      previewMatch = responseText.match(/<PREVIEW>([\s\S]{1,1000}?)$/);
      if (previewMatch) {
        console.log(`⚠️ Preview tag not properly closed, using lenient parsing`);
      }
    }
    if (!previewMatch) {
      return { success: false, error: 'Missing <PREVIEW> tag' };
    }
    const preview = previewMatch[1].trim();

    console.log(`✅ Successfully parsed delimited email`);
    console.log(`   Subject length: ${subject.length} chars`);
    console.log(`   Body length: ${body.length} chars`);
    console.log(`   Preview length: ${preview.length} chars`);

    return {
      success: true,
      data: { subject, body, preview }
    };
  } catch (error: any) {
    console.error(`❌ Delimited parsing error: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract suggested actions from email body HTML.
 * Parses [ACTIONS]...[/ACTIONS] block and returns array of actions.
 * Similar to extractSuggestedActions in ai-service.ts but for email context.
 * 
 * @param emailBody - HTML body of the email
 * @returns Array of actions with their metadata
 */
function extractEmailActions(emailBody: string): Array<{action: string; type: string; expectedCompletion?: string}> {
  console.log(`🔍 Extracting suggested actions from email body...`);

  // Try to extract JSON actions from the email body
  const actionsRegex = /\[ACTIONS\]\s*(\{[\s\S]*?\})\s*\[\/ACTIONS\]/;
  const match = emailBody.match(actionsRegex);

  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);

      if (parsed.actions && Array.isArray(parsed.actions)) {
        console.log(`✅ Successfully extracted ${parsed.actions.length} actions from email`);

        // Map new action types to legacy types for compatibility with verifyPreviousEmailActions
        const mapActionType = (newType: string): string => {
          const typeMap: Record<string, string> = {
            'open_exercise': 'exercise',
            'open_lesson': 'lesson',
            'book_consultation': 'task',
            'navigate': 'task',
            'complete_exercise': 'exercise',
            'view_lesson': 'lesson',
            'schedule_consultation': 'task',
            'daily_checkin': 'checkin',
            'reflection': 'reflection',
            'open_document': 'task',
            'view_roadmap': 'task',
            'complete_task': 'task',
            'review_progress': 'task'
          };

          // Default unknown types to 'task' for broader compatibility
          return typeMap[newType] || 'task';
        };

        // Transform to the format expected for storage with mapped types
        return parsed.actions.map((action: any) => {
          const originalType = action.type || 'navigate';
          const mappedType = mapActionType(originalType);

          if (originalType !== mappedType) {
            console.log(`   📝 Mapped action type: ${originalType} → ${mappedType}`);
          }

          return {
            action: action.label || action.action || '',
            type: mappedType,
            expectedCompletion: action.expectedCompletion
          };
        });
      }
    } catch (e) {
      console.error(`❌ Failed to parse actions JSON:`, e);
      return [];
    }
  }

  console.log(`⚠️  No [ACTIONS] block found in email body`);
  return [];
}

/**
 * Try to extract partial JSON data when parsing fails
 * Attempts to salvage what we can from malformed JSON
 */
function tryExtractPartialJson(jsonText: string, parseError: any): any {
  try {
    // Try to find where the JSON broke
    const errorMatch = parseError.message.match(/position (\d+)/);
    if (errorMatch) {
      const errorPos = parseInt(errorMatch[1]);
      console.log(`🔍 JSON broke at position ${errorPos}`);

      // Try to extract subject and preview from the beginning
      const subjectMatch = jsonText.match(/"subject"\s*:\s*"([^"]*?)"/);
      const previewMatch = jsonText.match(/"preview"\s*:\s*"([^"]*?)"/);

      // Try to extract body up to the error position
      const bodyMatch = jsonText.substring(0, errorPos).match(/"body"\s*:\s*"([\s\S]*?)$/);

      if (subjectMatch || previewMatch || bodyMatch) {
        console.log('📦 Extracted partial data from broken JSON');
        return {
          subject: subjectMatch?.[1] || null,
          preview: previewMatch?.[1] || null,
          body: bodyMatch?.[1] || null,
          _partial: true
        };
      }
    }
  } catch (extractError) {
    console.error('Failed to extract partial data:', extractError);
  }

  return null;
}

/**
 * Generate email with retry mechanism
 * Retries with clearer prompts if JSON parsing fails
 */
async function generateEmailWithRetry(
  systemPrompt: string,
  userMessage: string,
  clientName: string,
  client: GeminiClient,
  maxAttempts: number = 3
): Promise<{ subject: string; body: string; preview: string }> {

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Generation attempt ${attempt}/${maxAttempts}`);

      // Modify prompt on retry attempts to emphasize format compliance
      let modifiedUserMessage = userMessage;
      if (attempt > 1) {
        modifiedUserMessage = `⚠️ CRITICAL: The previous response had formatting errors. Please ensure:
- Start IMMEDIATELY with <SUBJECT> tag (no introductory text)
- Use EXACTLY this structure: <SUBJECT>...</SUBJECT><BODY>...</BODY><PREVIEW>...</PREVIEW>
- NO markdown code blocks (\`\`\`), NO explanations, NO extra text
- ALL three tags must be present and properly closed
- The response must be ONLY the delimited content

${userMessage}`;
      }

      // Build generation config - only include systemInstruction if not empty
      const generationConfig: any = {
        temperature: 0.8,
        maxOutputTokens: 65536, // Vertex AI max limit (65537 exclusive)
      };
      
      // Only add systemInstruction if it's not empty (Vertex AI rejects empty strings)
      if (systemPrompt && systemPrompt.trim().length > 0) {
        generationConfig.systemInstruction = systemPrompt;
      }

      // Call Gemini API using the provider client
      const result = await client.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: modifiedUserMessage }] }],
        generationConfig,
      });

      const responseText = result.response.text();
      console.log(`📝 AI response length: ${responseText.length} characters (attempt ${attempt})`);

      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      // Log first part of raw response for debugging
      console.log(`📄 Raw AI response (first 500 chars):\n${responseText.substring(0, 500)}`);

      // Parse using delimited format (XML-style tags)
      const parseResult = parseDelimitedEmail(responseText);

      if (parseResult.success && parseResult.data) {
        const emailData = parseResult.data;

        // Validate structure
        if (!emailData.subject || !emailData.body || !emailData.preview) {
          console.error(`❌ Missing fields in parsed email:`, {
            hasSubject: !!emailData.subject,
            hasBody: !!emailData.body,
            hasPreview: !!emailData.preview
          });
          throw new Error("Invalid email structure (missing fields)");
        }

        console.log(`✅ Email generated successfully on attempt ${attempt}`);
        return {
          subject: emailData.subject,
          body: emailData.body,
          preview: emailData.preview
        };
      } else {
        // Parsing failed - throw to retry
        throw new Error(`Delimited parsing failed: ${parseResult.error}`);
      }

    } catch (error: any) {
      // Log full error details for debugging
      console.error(`❌ Attempt ${attempt}/${maxAttempts} failed:`, error?.message || JSON.stringify(error));

      // If this is the last attempt, throw to fall back to template
      if (attempt === maxAttempts) {
        throw error;
      }

      // Small delay before retry
      console.log(`⏸️ Waiting 2s before retry...`);
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`🔄 Retrying with enhanced prompt...`);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new Error('All retry attempts exhausted');
}

export async function generateMotivationalEmail(
  input: EmailGeneratorInput
): Promise<GeneratedEmail> {
  try {
    // Task 9: Verify previous email actions if available
    let actionsVerificationResult: {completed: boolean; details: Array<{action: string; completed: boolean; completedAt?: string}>} | null = null;
    if (input.previousEmailData && input.previousEmailData.lastEmailActions.length > 0) {
      console.log(`📋 Verifying previous email actions...`);
      actionsVerificationResult = await verifyPreviousEmailActions(
        input.clientId,
        input.previousEmailData.lastEmailActions
      );

      // Update actions completed data in the input for use in prompt
      if (input.previousEmailData.actionsCompletedData) {
        input.previousEmailData.actionsCompletedData = actionsVerificationResult;
      }
    }

    // Get AI provider using 3-tier priority system
    const { client: aiClient, cleanup } = await getAIProvider(input.clientId, input.consultantId);
    console.log(`✅ AI provider selected successfully`);

// Get full user context
console.log(`🔍 Building full user context for client ${input.clientId}...`);
const userContext = await buildUserContext(input.clientId);
console.log(`✅ User context built successfully`);

// Get previous emails (last 20 for better anti-repetition)
console.log(`📧 Retrieving previous email history...`);
const previousEmails = await storage.getEmailLogsByClient(input.clientId, 20);
console.log(`✅ Retrieved ${previousEmails.length} previous emails`);

// Task 10: Use journey template tone if available, otherwise use emailTone or default
const emailTone = input.journeyTemplate?.tone || input.emailTone || 'motivazionale';
console.log(`🎨 Using email tone: ${emailTone}${input.journeyTemplate ? ' (from journey template)' : ''}`);

// Build system prompt using buildSystemPrompt (contains full user context)
console.log(`🤖 Building system prompt with buildSystemPrompt...`);
const systemPrompt = buildSystemPrompt('consulente', 'finanziario', userContext);

// Build consultation summaries section (from recent completed consultations)
const consultationSummariesSection = userContext.consultations.recent.filter((c: any) => c.summaryEmail).length > 0
? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 RIEPILOGHI CONSULENZE PRECEDENTI (TUTTE - per evitare ripetizioni e mantenere coerenza)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${userContext.consultations.recent.filter((c: any) => c.summaryEmail).map((c: any, i: number) => {
  const emailText = c.summaryEmail.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview = emailText.length > 1500 ? emailText.substring(0, 1500) + '...' : emailText;
  return `
CONSULENZA #${i + 1} (${new Date(c.scheduledAt).toLocaleDateString('it-IT')}):
${preview}
`;
}).join('\n')}

⚠️ IMPORTANTE: 
- Questi riepiloghi contengono le discussioni e azioni concordate nelle consulenze passate
- USA queste informazioni per evitare di ripetere argomenti già trattati
- MANTIENI coerenza con quanto discusso e pianificato in consulenza
- Se l'email motiva verso un'azione, assicurati che sia coerente con il piano della consulenza

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
: '';

// Build previous emails section for userMessage
const previousEmailsSection = previousEmails.length > 0
? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 STORICO EMAIL PRECEDENTI (ultime ${previousEmails.length} - analizza per evitare ripetizioni)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${previousEmails.map((email, i) => `
EMAIL #${i + 1} (${email.sentAt ? new Date(email.sentAt).toLocaleDateString('it-IT') : 'N/A'}):
Subject: ${email.subject || 'N/A'}
Preview: ${email.body ? email.body.replace(/<[^>]*>/g, '').substring(0, 150) + '...' : 'N/A'}
`).join('\n')}

⚠️ IMPORTANTE: NON ripetere gli stessi contenuti, argomenti o frasi delle email precedenti.
Trova nuovi angoli, nuove prospettive, nuovi elementi dal contesto per personalizzare questa email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
: '';

// Build tasks section
const tasksSection = input.incompleteTasks.length > 0
? `

✅ TASK DA COMPLETARE (${input.incompleteTasks.length}):
${input.incompleteTasks.slice(0, 5).map((t, i) => {
const urgency = t.priority === 'urgent' ? ' 🔴 URGENTE' : t.priority === 'high' ? ' 🟠 ALTA PRIORITÀ' : '';
const deadline = t.dueDate ? ` (scadenza: ${t.dueDate})` : '';
return `${i + 1}. ${t.title}${urgency}${deadline}`;
}).join('\n')}
${input.incompleteTasks.length > 5 ? `...e altre ${input.incompleteTasks.length - 5} task` : ''}
`
: '';

// Build goals section
const goalsSection = input.activeGoals.length > 0
? `

🎯 OBIETTIVI ATTIVI DEL CLIENTE:
${input.activeGoals.map(g => 
`  • ${g.title}: ${g.currentValue} → ${g.targetValue}`
).join('\n')}
`
: '';

// Task 11: Build exercises status section - CRITICAL to prevent AI from suggesting already completed exercises
const completedExercises = userContext.exercises.all.filter((e: any) => e.status === 'completed');
const returnedExercises = userContext.exercises.all.filter((e: any) => e.status === 'returned');
const inProgressExercises = userContext.exercises.all.filter((e: any) => e.status === 'in_progress');
const pendingExercises = userContext.exercises.all.filter((e: any) => e.status === 'pending');

const exercisesStatusSection = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STATO ESERCIZI DEL CLIENTE - LEGGI ATTENTAMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${completedExercises.length > 0 ? `
✅ ESERCIZI COMPLETATI (${completedExercises.length}):
${completedExercises.map((e: any, i: number) => {
  const completedDate = e.completedAt ? ` (completato il ${new Date(e.completedAt).toLocaleDateString('it-IT')})` : '';
  return `  ${i + 1}. ${e.title}${completedDate}`;
}).join('\n')}

🚨 REGOLA CRITICA: NON suggerire MAI questi esercizi nell'email. Sono GIÀ COMPLETATI.
NON dire "completa la sezione Avatar" se è già completata sopra.
NON dire "affina l'esercizio X" se è già completato sopra.
` : '❌ Nessun esercizio completato ancora.\n'}
${returnedExercises.length > 0 ? `
🔄 ESERCIZI IN REVISIONE (rimandati indietro dal consulente - ${returnedExercises.length}):
${returnedExercises.map((e: any, i: number) => `  ${i + 1}. ${e.title}${e.consultantFeedback ? ` - Feedback: ${e.consultantFeedback.slice(0, 100)}...` : ''}`).join('\n')}

⚠️ Questi richiedono miglioramenti. PUOI suggerire di rivederli SE necessario.
` : ''}
${inProgressExercises.length > 0 ? `
📝 ESERCIZI IN CORSO (${inProgressExercises.length}):
${inProgressExercises.map((e: any, i: number) => `  ${i + 1}. ${e.title}`).join('\n')}

✅ PUOI motivare il cliente a completarli.
` : ''}
${pendingExercises.length > 0 ? `
⏳ ESERCIZI DA INIZIARE (${pendingExercises.length}):
${pendingExercises.map((e: any, i: number) => `  ${i + 1}. ${e.title}${e.dueDate ? ` (scadenza: ${new Date(e.dueDate).toLocaleDateString('it-IT')})` : ''}`).join('\n')}

✅ PUOI suggerire di iniziarli se pertinenti.
` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// Task 11: Build university lessons status section - CRITICAL to prevent AI from suggesting already completed lessons
// Extract all lessons from hierarchical structure
const allLessons: Array<{id: string; title: string; completed: boolean; moduleName: string}> = [];
userContext.university.assignedYears.forEach((year: any) => {
  year.trimesters.forEach((trimester: any) => {
    trimester.modules.forEach((module: any) => {
      module.lessons.forEach((lesson: any) => {
        allLessons.push({
          id: lesson.id,
          title: lesson.title,
          completed: lesson.completed || false,
          moduleName: module.title
        });
      });
    });
  });
});

const completedLessons = allLessons.filter(l => l.completed);
const incompleteLessons = allLessons.filter(l => !l.completed);

const lessonsStatusSection = allLessons.length > 0 ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📖 STATO LEZIONI UNIVERSITY - LEGGI ATTENTAMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${completedLessons.length > 0 ? `
✅ LEZIONI GIÀ COMPLETATE (${completedLessons.length}):
${completedLessons.map((l: any, i: number) => `  ${i + 1}. ${l.title} (Modulo: ${l.moduleName})`).join('\n')}

🚨 REGOLA CRITICA: NON suggerire MAI queste lezioni nell'email. Sono GIÀ COMPLETATE.
NON dire "rivedi la lezione X" se è già completata sopra.
NON dire "studia la lezione Y" se è già stata vista sopra.
` : '❌ Nessuna lezione completata ancora.\n'}
${incompleteLessons.length > 0 ? `
📚 LEZIONI DA COMPLETARE (${incompleteLessons.length}):
${incompleteLessons.slice(0, 10).map((l: any, i: number) => `  ${i + 1}. ${l.title} (Modulo: ${l.moduleName})`).join('\n')}
${incompleteLessons.length > 10 ? `...e altre ${incompleteLessons.length - 10} lezioni` : ''}

✅ PUOI suggerire di studiare queste lezioni se pertinenti al percorso del cliente.
` : '✅ Tutte le lezioni assegnate sono state completate!\n'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';

// Task 11: Build library documents status section - CRITICAL to prevent AI from suggesting already read documents
const readDocuments = userContext.library.documents.filter((d: any) => d.isRead);
const unreadDocuments = userContext.library.documents.filter((d: any) => !d.isRead);

const libraryDocumentsStatusSection = userContext.library.documents.length > 0 ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 STATO DOCUMENTI BIBLIOTECA - LEGGI ATTENTAMENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${readDocuments.length > 0 ? `
✅ DOCUMENTI GIÀ LETTI (${readDocuments.length}):
${readDocuments.map((d: any, i: number) => `  ${i + 1}. ${d.title}${d.categoryName ? ` (Categoria: ${d.categoryName})` : ''}`).join('\n')}

🚨 REGOLA CRITICA: NON suggerire MAI questi documenti nell'email. Sono GIÀ STATI LETTI.
NON dire "leggi il documento X" se è già stato letto sopra.
NON dire "studia il materiale Y" se è già nella lista letta sopra.
` : '❌ Nessun documento letto ancora.\n'}
${unreadDocuments.length > 0 ? `
📖 DOCUMENTI DA LEGGERE (${unreadDocuments.length}):
${unreadDocuments.slice(0, 10).map((d: any, i: number) => `  ${i + 1}. ${d.title}${d.categoryName ? ` (Categoria: ${d.categoryName})` : ''}${d.estimatedDuration ? ` - ${d.estimatedDuration} min` : ''}`).join('\n')}
${unreadDocuments.length > 10 ? `...e altri ${unreadDocuments.length - 10} documenti` : ''}

✅ PUOI suggerire di leggere questi documenti se pertinenti al percorso e agli obiettivi del cliente.
` : '✅ Tutti i documenti disponibili sono stati letti!\n'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';

// Build consultation section with precise day text to avoid AI interpretation errors
const getConsultationDayText = (days: number): string => {
  if (days === 0) return 'OGGI (stesso giorno)';
  if (days === 1) return 'DOMANI (tra esattamente 1 giorno)';
  if (days === 2) return 'DOPODOMANI (tra esattamente 2 giorni)';
  return `Tra esattamente ${days} giorni`;
};

// Log consultation info for debugging
if (input.daysUntilNextConsultation !== null) {
  console.log(`🗓️ [EMAIL GEN] Consultation days for ${input.clientName}:`, {
    daysUntilNextConsultation: input.daysUntilNextConsultation,
    textGenerated: getConsultationDayText(input.daysUntilNextConsultation),
    timestamp: new Date().toISOString()
  });
}

const consultationSection = input.daysUntilNextConsultation !== null && input.daysUntilNextConsultation <= 7
? `

🗓️ PROSSIMA CONSULENZA: ${getConsultationDayText(input.daysUntilNextConsultation)}

⚠️ IMPORTANTE: Usa ESATTAMENTE il testo sopra nell'email. NON interpretare, NON ricalcolare, NON modificare il numero di giorni.
`
: '';

// Task 10: Build previous email actions verification section
const actionsVerificationSection = actionsVerificationResult
? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 AZIONI DALL'EMAIL PRECEDENTE - VERIFICA COMPLETAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actionsVerificationResult.details.map((detail, i) => {
  const status = detail.completed ? '✅ COMPLETATA' : '❌ NON COMPLETATA';
  const date = detail.completedAt ? ` (il ${new Date(detail.completedAt).toLocaleDateString('it-IT')})` : '';
  return `${i + 1}. ${detail.action}: ${status}${date}`;
}).join('\n')}

📊 Risultato: ${actionsVerificationResult.completed ? '✅ Tutte le azioni completate! Celebra questo successo.' : '⚠️ Alcune azioni ancora da completare - motiva il cliente gentilmente.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
: '';

// Build suggested actions prompt section (reusable for both journey and generic emails)
const suggestedActionsPromptSection = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 AZIONI SUGGERITE (OBBLIGATORIO - MOLTO IMPORTANTE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DEVI SEMPRE includere 2-4 azioni cliccabili alla fine dell'HTML del body.

Posiziona il blocco [ACTIONS] DOPO il contenuto principale ma PRIMA del footer.

📋 FORMATO ESATTO (copia questo esempio):

[ACTIONS]
{"actions": [
  {"type": "open_exercise", "label": "📝 Apri l'esercizio 'Nome Esercizio'", "exerciseId": "id-esercizio", "route": "/client/exercises"},
  {"type": "open_lesson", "label": "📖 Rivedi lezioni Modulo X", "lessonId": "id-lezione", "route": "/client/university"},
  {"type": "book_consultation", "label": "📞 Prenota la prossima consulenza", "route": "/client/consultations"}
]}
[/ACTIONS]

🔧 TIPI DI AZIONI DISPONIBILI:

1. **open_exercise**: Apri esercizio specifico
   - Richiede: exerciseId (usa ID reale dagli esercizi pending sopra)
   - Esempio: {"type": "open_exercise", "label": "📝 Apri 'Analisi Finanziaria'", "exerciseId": "analisi-finanziaria-123", "route": "/client/exercises"}

2. **open_lesson**: Apri lezione specifica
   - Richiede: lessonId (usa ID reale dalle lezioni non completate)
   - Esempio: {"type": "open_lesson", "label": "📖 Rivedi 'Fondamenti Marketing'", "lessonId": "lesson-uuid-456", "route": "/client/university"}

3. **book_consultation**: Prenota consulenza
   - Esempio: {"type": "book_consultation", "label": "📞 Prenota la prossima consulenza", "route": "/client/consultations"}

4. **navigate**: Vai a una pagina generica
   - Route disponibili: "/client/exercises", "/client/university", "/client/goals", "/client/consultations", "/client/daily-tasks"
   - Esempio: {"type": "navigate", "label": "📊 Visualizza i tuoi obiettivi", "route": "/client/goals"}

⚠️ REGOLE FONDAMENTALI:

1. ✅ USA SOLO exerciseId e lessonId REALI dai dati forniti sopra nelle sezioni TASK e dati del contesto
2. ✅ Il label deve essere DESCRITTIVO e includere il nome specifico dell'elemento
3. ✅ Ogni azione DEVE avere: type, label, route
4. ✅ Se type="open_exercise", aggiungi anche: exerciseId
5. ✅ Se type="open_lesson", aggiungi anche: lessonId
6. ✅ POSIZIONA [ACTIONS] nell'HTML DOPO il contenuto ma PRIMA del footer
7. ✅ NON includere [ACTIONS] nel tag <PREVIEW>
8. ✅ Il JSON deve essere VALIDO e su una singola riga compatta

❌ NON inventare exerciseId o lessonId - usa SOLO quelli reali forniti nei dati
❌ NON mettere [ACTIONS] nel <PREVIEW>
❌ NON formattare il JSON su più righe (deve essere compatto)

📝 ESEMPIO PRATICO CON DATI REALI:

Se nei dati vedi:
${input.incompleteTasks.length > 0 ? `
TASK DA COMPLETARE:
${input.incompleteTasks.slice(0, 3).map((t, i) => `${i + 1}. ${t.title}`).join('\n')}
` : 'Nessun task pending - usa azioni generiche come book_consultation o navigate'}

Allora nell'HTML, prima del footer, inserisci:

[ACTIONS]
{"actions": [${input.incompleteTasks.length > 0 ? `
  {"type": "navigate", "label": "✅ Visualizza i tuoi task", "route": "/client/daily-tasks"},` : ''}
  {"type": "book_consultation", "label": "📞 Prenota la prossima consulenza", "route": "/client/consultations"}${input.activeGoals.length > 0 ? `,
  {"type": "navigate", "label": "🎯 Controlla i tuoi obiettivi", "route": "/client/goals"}` : ''}
]}
[/ACTIONS]

🎨 POSIZIONAMENTO NELL'HTML:

Inserisci [ACTIONS] nell'HTML così:

<div style="padding: 40px 30px;">
  <p>Contenuto principale dell'email...</p>

  <!-- Altri paragrafi e sezioni -->

  <p style="margin-top: 40px;">Continua così! 💪</p>

  <p>Un caro saluto,<br/>Il Tuo Consulente</p>
</div>

[ACTIONS]
{"actions": [...]}
[/ACTIONS]

<!-- Footer -->
<div style="background: #f8fafc; padding: 30px;">
  Footer content...
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// Task 10: Use journey template's promptTemplate if available, otherwise use generic prompt
let userMessage: string;

if (input.journeyTemplate) {
  // Use custom prompt from journey template
  console.log(`📝 Using custom prompt from journey template: "${input.journeyTemplate.title}"`);

  userMessage = `${input.journeyTemplate.promptTemplate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 INFORMAZIONI SPECIFICHE PER QUESTA EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CLIENTE: ${input.clientName}

📍 STATO ATTUALE:
${input.currentState}

🎯 STATO IDEALE (dove vuole arrivare):
${input.idealState}

💭 BENEFICIO INTERNO (emotivo/psicologico):
${input.internalBenefit || 'Non specificato'}

🏡 BENEFICIO ESTERNO (tangibile):
${input.externalBenefit || 'Non specificato'}

⚠️ OSTACOLO PRINCIPALE:
${input.mainObstacle || 'Non specificato'}

${input.pastAttempts ? `🔄 COSA HA GIÀ PROVATO IN PASSATO:
${input.pastAttempts}

` : ''}${input.currentActions ? `⚡ COSA STA FACENDO ADESSO:
${input.currentActions}

` : ''}${input.futureVision ? `🚀 VISIONE 3-5 ANNI (dove si vede):
${input.futureVision}

` : ''}${input.motivationDrivers ? `💪 COSA LA MOTIVA:
${input.motivationDrivers}

` : ''}${tasksSection}${goalsSection}${exercisesStatusSection}${lessonsStatusSection}${libraryDocumentsStatusSection}${consultationSection}${actionsVerificationSection}${consultationSummariesSection}${previousEmailsSection}
${suggestedActionsPromptSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 OUTPUT RICHIESTO (FORMATO CON DELIMITATORI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Genera l'email e restituiscila usando delimitatori unici.
NON USARE JSON. Usa questa struttura ESATTA:

<SUBJECT>
Testo del subject line (max 60 caratteri, accattivante e personale)
</SUBJECT>
<BODY>
HTML COMPLETO con stili inline (400-600 parole, visivamente ricco) + blocco [ACTIONS] prima del footer
</BODY>
<PREVIEW>
Prime 50-60 parole dell'email (testo plain senza HTML, SENZA il blocco [ACTIONS])
</PREVIEW>

⚠️ IMPORTANTE: 
- Restituisci SOLO questo formato, senza altre parole, spiegazioni, o \`\`\`.
- La risposta DEVE iniziare con <SUBJECT>.
- L'HTML nel body deve essere completo e stilizzato.
- INCLUDI il blocco [ACTIONS] nel <BODY> come specificato sopra.
- NON includere [ACTIONS] nel <PREVIEW>.

Genera l'email ORA:`;
} else {
  // Use generic prompt (existing logic)
  userMessage = `Genera un'email personalizzata e motivazionale per il cliente ${input.clientName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 TONO EMAIL RICHIESTO: ${emailTone.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adatta il tono dell'email a: "${emailTone}"
- motivazionale: empatico, energico, incoraggiante
- formale: professionale, rispettoso, misurato
- amichevole: caloroso, informale ma rispettoso
- professionale: competente, diretto, orientati ai risultati

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 INFORMAZIONI SPECIFICHE PER QUESTA EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CLIENTE: ${input.clientName}

📍 STATO ATTUALE:
${input.currentState}

🎯 STATO IDEALE (dove vuole arrivare):
${input.idealState}

💭 BENEFICIO INTERNO (emotivo/psicologico):
${input.internalBenefit || 'Non specificato'}

🏡 BENEFICIO ESTERNO (tangibile):
${input.externalBenefit || 'Non specificato'}

⚠️ OSTACOLO PRINCIPALE:
${input.mainObstacle || 'Non specificato'}

${input.pastAttempts ? `🔄 COSA HA GIÀ PROVATO IN PASSATO:
${input.pastAttempts}

` : ''}${input.currentActions ? `⚡ COSA STA FACENDO ADESSO:
${input.currentActions}

` : ''}${input.futureVision ? `🚀 VISIONE 3-5 ANNI (dove si vede):
${input.futureVision}

` : ''}${input.motivationDrivers ? `💪 COSA LA MOTIVA:
${input.motivationDrivers}

` : ''}${tasksSection}${goalsSection}${exercisesStatusSection}${lessonsStatusSection}${libraryDocumentsStatusSection}${consultationSection}${actionsVerificationSection}${consultationSummariesSection}${previousEmailsSection}
${suggestedActionsPromptSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ISTRUZIONI PER LA GENERAZIONE EMAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⭐ CREA UN'EMAIL VISIVAMENTE RICCA E DETTAGLIATA ⭐

Il system prompt contiene TUTTO il contesto del cliente (esercizi, università, biblioteca, roadmap, obiettivi, ecc.).

1. **FORMATO HTML PROFESSIONALE** 🎨
- Usa HTML con stili inline per una grafica ricca e accattivante
- Colori: blu (#2563eb), viola (#7c3aed), verde (#10b981), grigio (#64748b)
- Font: Arial, sans-serif con line-height 1.6
- Sfondo: bianco (#ffffff) con sezioni colorate (#f8fafc, #eff6ff)
- Bordi arrotondati, ombre, gradienti per un look moderno

2. **LUNGHEZZA**: 400-600 parole (DETTAGLIATA e completa)
- Molto più contenuto rispetto a una email standard
- Paragrafi ricchi di dettagli personali
- Riferimenti specifici al percorso del cliente
- Connessioni profonde tra esercizi, obiettivi e progressi

3. **STRUTTURA HTML RICCA**:
   {/* FIX: Aggiunto escape ai backtick qui */}
\`\`\`html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
<div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; text-align: center; color: white; border-radius: 12px 12px 0 0;">
<h1 style="margin: 0; font-size: 24px;">Titolo Motivante</h1>
</div>

<div style="padding: 30px; color: #333;">
<p>Saluto caloroso e personale...</p>

<div style="background: linear-gradient(135deg, #eff6ff 0%, #f3e8ff 100%); border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 8px;">
<p style="margin: 0; font-weight: 600;">Punto chiave evidenziato</p>
</div>

<p>Paragrafo dettagliato con riferimenti specifici...</p>

<div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
<h3 style="color: #1e293b; margin-top: 0;">📊 I Tuoi Progressi</h3>
<ul style="color: #475569; line-height: 1.8;">
<li>Dettaglio specifico 1</li>
<li>Dettaglio specifico 2</li>
</ul>
</div>

<div style="text-align: center; margin: 30px 0;">
<a href="#" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Continua il Percorso</a>
</div>

<p>Chiusura motivante...</p>
</div>

<div style="background: #f8fafc; padding: 20px; text-align: center; color: #64748b; border-radius: 0 0 12px 12px;">
<p style="margin: 0; font-size: 14px;">Il Tuo Consulente</p>
</div>
</div>
   {/* FIX: Aggiunto escape ai backtick qui */}
\`\`\`

4. **CONTENUTO DETTAGLIATO E PERSONALIZZATO**:
✅ Menziona ALMENO 3-4 elementi specifici del percorso (esercizi, lezioni, obiettivi)
✅ Approfondisci ogni punto con 2-3 frasi
✅ Collega i progressi agli obiettivi finali con esempi concreti
✅ Usa box colorati per evidenziare punti chiave
✅ Aggiungi sezioni strutturate (progressi, prossimi passi, motivazione)
✅ Includi emoji strategicamente (max 5-6 in tutta l'email)

❌ NO testo piatto senza formattazione
❌ NO email brevi e generiche
❌ NO mancanza di riferimenti specifici al cliente

5. **PERSONALIZZAZIONE PROFONDA**:
- Inizia con un saluto caldo e un riferimento specifico recente
- Crea una sezione "I Tuoi Progressi" con dettagli concreti
- Aggiungi una sezione "Cosa Ti Aspetta" con prossimi passi
- Includi una call-to-action visivamente evidente
- Chiudi con una nota motivante e personale
- Firma con il ruolo del consulente

6. **ESEMPIO STRUTTURA COMPLETA**:
- Header colorato con titolo motivante (50-80 parole)
- Introduzione personale (100-150 parole)
- Box evidenziato con insight chiave (50-80 parole)
- Sezione progressi dettagliata (100-150 parole)
- Sezione prossimi passi (80-100 parole)
- Call-to-action + chiusura (50-80 parole)
- Footer con firma

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 OUTPUT RICHIESTO (FORMATO CON DELIMITATORI):

Genera l'email e restituiscila usando delimitatori unici.
NON USARE JSON. Usa questa struttura ESATTA:

<SUBJECT>
Testo del subject line (max 60 caratteri, accattivante e personale)
</SUBJECT>
<BODY>
HTML COMPLETO con stili inline (400-600 parole, visivamente ricco) + blocco [ACTIONS] prima del footer
</BODY>
<PREVIEW>
Prime 50-60 parole dell'email (testo plain senza HTML, SENZA il blocco [ACTIONS])
</PREVIEW>

⚠️ IMPORTANTE: 
- Restituisci SOLO questo formato, senza altre parole, spiegazioni, o \`\`\`.
- La risposta DEVE iniziare con <SUBJECT>.
- L'HTML nel body deve essere completo e stilizzato come da istruzioni.
- INCLUDI il blocco [ACTIONS] nel <BODY> come specificato sopra.
- NON includere [ACTIONS] nel <PREVIEW>.

Genera l'email ORA:`;
}

    // Use retry mechanism to generate email with robust error handling
    console.log(`🚀 Starting email generation with retry mechanism...`);
    const emailData = await generateEmailWithRetry(
      systemPrompt,
      userMessage,
      input.clientName,
      aiClient,
      3 // Max 3 attempts
    );

    console.log(`✅ Email generation complete`);
    console.log(`   Subject: ${emailData.subject}`);
    console.log(`   Body length: ${emailData.body.length} characters`);

    // Extract suggested actions before cleaning the body
    const extractedActions = extractEmailActions(emailData.body);

    // Remove [ACTIONS] block from body HTML to keep it clean
    const cleanBody = emailData.body.replace(/\[ACTIONS\]\s*\{[\s\S]*?\}\s*\[\/ACTIONS\]/g, '').trim();
    console.log(`🧹 Removed [ACTIONS] block from body HTML`);

    // Enhance HTML typography for perfect consistency
    const enhancedBody = enhanceEmailTypography(cleanBody);
    console.log(`✨ Typography enhanced for perfect readability`);

    // Cleanup provider resources if needed
    if (cleanup) {
      await cleanup();
      console.log(`🧹 AI provider resources cleaned up`);
    }

    return {
      subject: emailData.subject,
      body: enhancedBody,
      preview: emailData.preview,
      actions: extractedActions,
    };
  } catch (error: any) {
    console.error("Error generating motivational email:", error);

    // Fallback to template-based email if AI fails
    return generateFallbackEmail(input);
  }
}

// Fallback email generator (template-based) if AI fails - stile ricco HTML
function generateFallbackEmail(input: EmailGeneratorInput): GeneratedEmail {
  const subject = `${input.clientName}, riflessioni sul tuo percorso`;

  const firstTask = input.incompleteTasks.length > 0 ? input.incompleteTasks[0].title : null;

  // Box per i Task (stile verde più evidente)
  const taskSection = firstTask ? `
<div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 25px; margin: 30px 0; border-radius: 12px;">
  <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 20px; font-weight: 700;">📋 La tua prossima azione</h3>
  <p style="margin: 0; font-weight: 600; color: #15803d; font-size: 16px; line-height: 1.6;">
    Ho visto che hai "${firstTask}" tra le tue priorità. Completare questo passo è un ottimo modo per avanzare!
  </p>
</div>
` : '';

  // Box per la Consulenza (stile blu/viola più evidente)
  const consultationMention = input.daysUntilNextConsultation !== null && input.daysUntilNextConsultation <= 7 
? `
<div style="background: linear-gradient(135deg, #eff6ff 0%, #f3e8ff 100%); border-left: 4px solid #4f46e5; padding: 25px; margin: 30px 0; border-radius: 12px;">
  <p style="margin: 0; font-weight: 700; color: #1e40af; font-size: 18px;">
    🗓️ La nostra prossima consulenza è tra ${input.daysUntilNextConsultation} giorni${input.daysUntilNextConsultation <= 2 ? ' - è vicinissima!' : ''}
  </p>
</div>
`
: '';

  const htmlBody = `
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.7; color: #333; background-color: #f5f7fa;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 40px 30px; text-align: center; color: white;">
        <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: 700;">Il Tuo Percorso di Crescita</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.95;">Riflessioni sulla tua evoluzione</p>
      </div>

      <!-- Content -->
      <div style="padding: 40px 30px;">
        <p style="font-size: 18px; margin-top: 0; color: #1e293b;">Ciao <strong>${input.clientName}</strong>,</p>

        <p style="font-size: 16px; line-height: 1.8; color: #475569; margin: 20px 0;">
          Stavo riflettendo sul tuo percorso e su dove ti stai dirigendo: <em style="color: #6b7280; font-style: italic;">"${input.idealState.substring(0, 120)}${input.idealState.length > 120 ? '...' : ''}"</em>
        </p>

        ${consultationMention}

        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 25px; margin: 30px 0; border-radius: 12px;">
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #92400e; line-height: 1.7;">
            💡 So che a volte il punto di partenza (<em>${input.currentState.substring(0, 80)}${input.currentState.length > 80 ? '...' : ''}</em>) può sembrare lontano dall'obiettivo, ma ogni piccola azione che fai oggi ti avvicina alla versione di te che vuoi diventare.
          </p>
        </div>

        ${taskSection}

        <div style="text-align: center; margin: 40px 0 30px 0;">
          <a href="https://coachale.replit.app" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); transition: transform 0.2s;">
            🚀 Accedi alla Piattaforma
          </a>
        </div>

        <p style="margin-top: 40px; font-size: 16px; color: #475569;">Continua così, sei sulla strada giusta! 💪</p>

        <p style="font-size: 16px; color: #1e293b; margin-top: 30px;">
          Un caro saluto,<br/>
          <strong>Il Tuo Consulente</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 30px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0; font-size: 14px;">
          <strong>Coachale Platform</strong>
        </p>
        <p style="margin: 0; font-size: 12px;">
          Questa è un'email automatica, ma il pensiero è reale.
        </p>
        <p style="margin: 10px 0 0 0; font-size: 12px;">
          © ${new Date().getFullYear()} Coachale Platform
        </p>
      </div>

    </div>
  </div>
</body>
</html>
`;

  const preview = `Ciao ${input.clientName}, stavo riflettendo sul tuo percorso verso ${input.idealState.substring(0, 50)}...`;

  // Enhance HTML typography for perfect consistency
  const enhancedBody = enhanceEmailTypography(htmlBody);

  return {
    subject,
    body: enhancedBody,
    preview
  };
}

// ============================================
// CONSULTATION SUMMARY EMAIL GENERATOR
// ============================================

export interface ConsultationSummaryInput {
  consultationId: string;
  clientId: string;
  consultantId: string;
  clientName: string;
  consultantName: string;
  consultationDate: Date;
  fathomTranscript: string;
  fathomShareLink?: string;
  googleMeetLink?: string;
  consultationNotes?: string;
  additionalNotes?: string; // Appunti extra solo per contesto AI, non salvati
}

/**
 * Genera email di riepilogo consulenza usando trascrizione Fathom completa
 * Questa funzione analizza la trascrizione e crea un riepilogo dettagliato con azioni da completare
 */
export async function generateConsultationSummaryEmail(
  input: ConsultationSummaryInput
): Promise<GeneratedEmail> {
  try {
    console.log(`📋 [CONSULTATION SUMMARY] Generating summary email for consultation ${input.consultationId}`);

    // Get AI provider using 3-tier priority system
    const { client: aiClient, cleanup } = await getAIProvider(input.clientId, input.consultantId);
    console.log(`✅ AI provider selected successfully`);

    // Build user context for better personalization
    console.log(`🔍 Building user context for client ${input.clientId}...`);
    const userContext = await buildUserContext(input.clientId);
    console.log(`✅ User context built successfully`);

    // Get client state for context
    const clientState = await storage.getClientState(input.clientId, input.consultantId);

    // Build previous consultation summaries section for continuity
    const previousConsultationSummaries = userContext.consultations.recent
      .filter((c: any) => c.summaryEmail && c.id !== input.consultationId);
      // Rimuovo .slice(-3) per includere TUTTE le consulenze precedenti (esclusa quella corrente)

    // Format consultation date
    const consultationDateStr = new Date(input.consultationDate).toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt('consulente', 'finanziario', userContext);

    // Build user message with complete Fathom transcript
    const userMessage = `Sei un consulente esperto che sta preparando un'email di riepilogo consulenza per il cliente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 INFORMAZIONI CONSULENZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente: ${input.clientName}
Consulente: ${input.consultantName}
Data Consulenza: ${consultationDateStr}
${input.fathomShareLink ? `Link Registrazione: ${input.fathomShareLink}` : ''}
${input.googleMeetLink ? `Link Google Meet: ${input.googleMeetLink}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TRASCRIZIONE COMPLETA CONSULENZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${input.fathomTranscript}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${previousConsultationSummaries.length > 0 ? `
📋 CONSULENZE PRECEDENTI (per mantenere continuità e coerenza)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${previousConsultationSummaries.map((c: any, i: number) => {
  const emailText = c.summaryEmail.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const preview = emailText.length > 1200 ? emailText.substring(0, 1200) + '...' : emailText;
  return `
CONSULENZA PRECEDENTE #${i + 1} (${new Date(c.scheduledAt).toLocaleDateString('it-IT')}):
${preview}
`;
}).join('\n')}

⚠️ IMPORTANTE: 
- Questi sono i riepiloghi delle consulenze PRECEDENTI con questo cliente
- USA queste informazioni per mantenere CONTINUITÀ nel percorso
- RIFERISCI a decisioni o azioni concordate nelle consulenze precedenti se rilevanti
- COSTRUISCI sul lavoro fatto in precedenza, non ricominciare da zero

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${input.consultationNotes ? `
📌 NOTE CONSULENTE:
${input.consultationNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${input.additionalNotes ? `
💭 CONTESTO AGGIUNTIVO (solo per generazione, non sarà salvato):
${input.additionalNotes}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${clientState ? `
🎯 STATO CLIENTE (per contestualizzare):
- Stato Attuale: ${clientState.currentState}
- Stato Ideale: ${clientState.idealState}
- Ostacolo Principale: ${clientState.mainObstacle}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

🎯 IL TUO COMPITO:

Analizza ATTENTAMENTE la trascrizione completa della consulenza e genera un'email professionale di riepilogo che:

1. **RIEPILOGO DETTAGLIATO**: Scrivi un riepilogo MOLTO approfondito (almeno 400-600 parole) della consulenza che copra:
   - Argomenti principali discussi
   - Problematiche emerse
   - Soluzioni proposte
   - Decisioni prese insieme
   - Punti di forza evidenziati
   - Aree di miglioramento identificate

2. **AZIONI CONCRETE**: Estrai ed elenca TUTTE le azioni specifiche menzionate durante la consulenza:
   - Cosa deve fare il cliente
   - Entro quando (se specificato)
   - Perché è importante
   - Ordine di priorità se menzionato

3. **PROSSIMI PASSI**: Indica chiaramente:
   - Cosa succederà dopo questa consulenza
   - Eventuali follow-up programmati
   - Materiali o risorse che saranno condivisi

4. **TONO**: Professionale ma caloroso, personalizzato sul cliente

5. **STRUTTURA HTML**: L'email deve essere in HTML ben formattato e responsive

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ISTRUZIONI CRITICHE PER ESTRAZIONE AZIONI DALLA TRASCRIZIONE FATHOM:

**COME IDENTIFICARE LE AZIONI NELLA TRASCRIZIONE:**

1. **CERCA QUESTI PATTERN NELLA TRASCRIZIONE:**
   - "Devi fare...", "Dovresti...", "Ti consiglio di..."
   - "Completa...", "Termina...", "Finisci..."
   - "Aggiungi...", "Modifica...", "Correggi..."
   - Riferimenti a esercizi specifici da completare
   - Task menzionate esplicitamente durante la call
   - Deadline o tempistiche menzionate

2. **FORMATO DELLE AZIONI - SEMPLICE E CHIARO:**
   - Inizia con un verbo all'infinito: "Completare", "Aggiungere", "Modificare"
   - Sii SPECIFICO: non "Lavorare sull'esercizio" ma "Completare la sezione 'Avatar' nell'Esercizio 1"
   - Includi il CONTESTO: riferimenti a esercizi, documenti, sezioni specifiche
   - Aggiungi SCADENZE se menzionate: "entro venerdì", "prima della prossima consulenza"

3. **ESEMPI DI AZIONI BEN FORMATTATE:**
   ✅ CORRETTO:
   - "Completare la sezione 'Avatar' nell'Esercizio 1 per definire le paure e i desideri più profondi del cliente ideale."
   - "Terminare il corso 'Vendita' nella sezione 'Università' per affinare le competenze di vendita."
   - "Aggiungere errori (cura/prevent, aware/unaware) all'Esercizio 2 entro venerdì."

   ❌ SBAGLIATO (troppo generico):
   - "Completare gli esercizi"
   - "Lavorare sul business"
   - "Migliorare l'offerta"

4. **ESTRAZIONE DALLE "ACTION ITEMS" DI FATHOM:**
   - Se la trascrizione contiene una sezione "Action Items" o "Azioni da intraprendere", usa QUELLE come base
   - Mantieni la formulazione originale ma rendila più chiara se necessario
   - Non inventare azioni - usa solo quelle ESPLICITAMENTE discusse

5. **PROSSIMI PASSI - COSA SCRIVERE:**
   - Focus sul FOLLOW-UP: quando ci rivedremo, cosa condividerò
   - Materiali da inviare dopo la consulenza
   - Preparazione per la prossima sessione
   - Supporto disponibile tra una consulenza e l'altra

   Esempio: "Ti invierò il documento 'Errori Comuni nel Posizionamento' entro domani. Ci rivedremo tra 2 settimane per rivedere i progressi. Nel frattempo, puoi usare l'Assistente IA per supporto sui materiali."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FORMATO RISPOSTA RICHIESTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restituisci l'email in questo formato ESATTO (rispetta i tag):

<SUBJECT>
Oggetto dell'email qui (max 80 caratteri)
</SUBJECT>

<PREVIEW>
Anteprima dell'email qui (max 150 caratteri)
</PREVIEW>

<BODY>
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; background-color: #f5f7fa;">
  <div style="max-width: 650px; margin: 20px auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

      <!-- Header Professionale -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; color: white;">
        <h1 style="margin: 0 0 10px 0; font-size: 26px; font-weight: 700;">📋 Riepilogo Consulenza</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.95;">${consultationDateStr}</p>
      </div>

      <!-- Contenuto -->
      <div style="padding: 40px 30px;">
        <p style="font-size: 18px; margin-top: 0; color: #1e293b;">Ciao <strong>${input.clientName}</strong>,</p>

        <p style="font-size: 16px; line-height: 1.8; color: #475569;">
          Ecco il riepilogo dettagliato della nostra consulenza di ${consultationDateStr}.
        </p>

        <!-- RIEPILOGO DETTAGLIATO -->
        <div style="padding: 25px 0; margin: 30px 0; border-bottom: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #1e293b;">📝 Riepilogo Approfondito</h2>
          <div style="font-size: 16px; line-height: 1.8; color: #475569;">
            [QUI IL RIEPILOGO DETTAGLIATO - ALMENO 400-600 PAROLE]
            [Usa paragrafi ben strutturati con <p> tags]
            [IMPORTANTE: Evidenzia concetti chiave SOLO con tag HTML <strong>testo</strong> - MAI usare markdown **testo**]
          </div>
        </div>

        <!-- AZIONI DA COMPLETARE -->
        <div style="padding: 25px 0; margin: 30px 0; border-bottom: 1px solid #e2e8f0;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #1e293b;">✅ Azioni da Completare</h2>
          <ul style="margin: 0; padding-left: 20px; font-size: 16px; line-height: 1.9; color: #475569;">
            <li>[Azione 1 con dettagli e scadenza se presente]</li>
            <li>[Azione 2...]</li>
            [... tutte le azioni estratte dalla trascrizione]
          </ul>
        </div>

        <!-- PROSSIMI PASSI -->
        <div style="padding: 25px 0; margin: 30px 0;">
          <h2 style="margin: 0 0 15px 0; font-size: 20px; color: #1e293b;">🎯 Prossimi Passi</h2>
          <p style="margin: 0; font-size: 16px; line-height: 1.8; color: #475569;">
            [Indica cosa succederà dopo, follow-up, materiali da condividere, ecc.]
          </p>
        </div>

        ${input.fathomShareLink ? `
        <!-- Link Registrazione -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${input.fathomShareLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
            🎥 Rivedi la Registrazione
          </a>
        </div>
        ` : ''}

        <p style="margin-top: 40px; font-size: 16px; color: #475569;">
          Se hai domande o dubbi su quanto discusso, non esitare a contattarmi!
        </p>

        <p style="font-size: 16px; color: #1e293b; margin-top: 30px;">
          Un caro saluto,<br/>
          <strong>${input.consultantName}</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 30px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0; font-size: 14px;">
          <strong>Coachale Platform</strong>
        </p>
        <p style="margin: 0; font-size: 12px;">
          Riepilogo consulenza del ${consultationDateStr}
        </p>
      </div>

    </div>
  </div>
</body>
</html>
</BODY>

⚠️ REGOLE FONDAMENTALI:
- Restituisci SOLO questo formato, senza altre parole o spiegazioni
- La risposta DEVE iniziare con <SUBJECT>
- L'HTML deve essere completo, ben formattato e responsive
- Il riepilogo deve essere MOLTO dettagliato (400-600 parole minimo)
- Estrai TUTTE le azioni specifiche dalla trascrizione
- Mantieni un tono professionale ma caloroso
- USA SOLO TAG HTML (<strong>, <em>, <p>, <ul>, <li>) - MAI markdown (**testo**, *testo*)

Genera l'email ORA:`;

    console.log(`🚀 Starting consultation summary generation with retry mechanism...`);

    // Use retry mechanism with aiClient (Vertex AI or fallback)
    const emailData = await generateEmailWithRetry(
      systemPrompt,
      userMessage,
      input.clientName,
      aiClient,
      3 // Max 3 attempts
    );

    console.log(`✅ Consultation summary email generated successfully`);
    console.log(`   Subject: ${emailData.subject}`);
    console.log(`   Body length: ${emailData.body.length} characters`);

    // Enhance HTML typography
    const enhancedBody = enhanceEmailTypography(emailData.body);

    // Cleanup provider resources if needed
    if (cleanup) {
      await cleanup();
      console.log(`🧹 AI provider resources cleaned up`);
    }

    return {
      subject: emailData.subject,
      body: enhancedBody,
      preview: emailData.preview,
    };

  } catch (error: any) {
    console.error(`❌ Error generating consultation summary email:`, error);
    throw new Error(`Failed to generate consultation summary: ${error.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERATE SYSTEM UPDATE EMAIL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface SystemUpdateEmailInput {
  clientId: string;
  consultantId: string;
  systemPrompt: string; // Custom system prompt from consultant
  updateContent: string; // Update details/content
  clientName: string;
  clientContext?: {
    currentState: string;
    idealState: string;
    tasksCount: number;
    goalsCount: number;
  };
}

export async function generateSystemUpdateEmail(
  input: SystemUpdateEmailInput
): Promise<GeneratedEmail> {
  try {
    console.log(`📢 [SYSTEM UPDATE EMAIL] Starting generation for ${input.clientName}...`);

    // Get AI provider using 3-tier priority system
    const { client: aiClient, cleanup } = await getAIProvider(input.clientId, input.consultantId);
    console.log(`✅ AI provider selected successfully`);

    // Build context section if available
    const contextSection = input.clientContext ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 CONTESTO CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nome: ${input.clientName}
Stato Attuale: ${input.clientContext.currentState}
Stato Ideale: ${input.clientContext.idealState}
Task Attivi: ${input.clientContext.tasksCount}
Obiettivi Attivi: ${input.clientContext.goalsCount}

` : '';

    // Build user message with custom system prompt
    const userMessage = `${input.systemPrompt}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 AGGIORNAMENTI DA COMUNICARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${input.updateContent}
${contextSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPITO:
Genera un'email personalizzata per ${input.clientName} che comunichi gli aggiornamenti sopra indicati.
${input.clientContext ? `Usa il contesto del cliente per personalizzare il messaggio, mostrando come questi aggiornamenti possono aiutarlo nel suo percorso verso lo stato ideale.` : 'Mantieni un tono professionale e motivazionale.'}

FORMATO RICHIESTO:
Rispondi ESATTAMENTE in questo formato (niente altro testo prima o dopo):

<SUBJECT>
[Scrivi qui il subject dell'email - max 60 caratteri, chiaro e coinvolgente]
</SUBJECT>

<BODY>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aggiornamenti Sistema</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
        📢 Novità e Aggiornamenti
      </h1>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      
      <p style="font-size: 18px; color: #1e293b; margin-bottom: 20px;">
        Ciao <strong>${input.clientName}</strong>,
      </p>

      <!-- CORPO PRINCIPALE DELL'EMAIL -->
      [Qui scrivi il contenuto principale dell'email in HTML]
      [Comunica gli aggiornamenti in modo chiaro e coinvolgente]
      [Usa paragrafi, liste, e formattazione HTML appropriata]
      [Se c'è contesto cliente, collega gli aggiornamenti al loro percorso]
      
      <!-- Chiusura -->
      <p style="font-size: 16px; color: #475569; margin-top: 30px;">
        Sono qui per qualsiasi domanda o chiarimento!
      </p>

      <p style="font-size: 16px; color: #1e293b; margin-top: 25px;">
        A presto,<br/>
        <strong>Il tuo Consulente</strong>
      </p>

    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 25px 30px; text-align: center; color: #64748b; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600;">
        Coachale Platform
      </p>
      <p style="margin: 0; font-size: 12px;">
        Aggiornamenti Sistema
      </p>
    </div>

  </div>
</body>
</html>
</BODY>

<PREVIEW>
[Scrivi qui un breve testo di anteprima per l'email - max 120 caratteri, che riassuma il contenuto]
</PREVIEW>

⚠️ REGOLE:
- Rispondi SOLO nel formato indicato sopra
- La risposta DEVE iniziare con <SUBJECT>
- Usa SOLO tag HTML (<p>, <strong>, <em>, <ul>, <li>) - MAI markdown
- L'email deve essere 250-400 parole
- Includi SEMPRE tutti e tre i tag: <SUBJECT>, <BODY>, <PREVIEW>
- Tono: ${input.systemPrompt.toLowerCase().includes('professionale') ? 'professionale' : input.systemPrompt.toLowerCase().includes('amichevole') ? 'amichevole' : 'motivazionale e positivo'}
- Se c'è contesto cliente, personalizza mostrando come gli aggiornamenti lo aiutano
- ⚠️ IMPORTANTE: NON usare MAI "stato ideale" - SEMPRE usa "quello che voglio raggiungere" al suo posto

Genera l'email ORA:`;

    console.log(`🚀 Starting system update email generation...`);

    // Use retry mechanism
    const emailData = await generateEmailWithRetry(
      '', // No additional system prompt - it's already in userMessage
      userMessage,
      input.clientName,
      aiClient,
      3 // Max 3 attempts
    );

    console.log(`✅ System update email generated successfully`);
    console.log(`   Subject: ${emailData.subject}`);
    console.log(`   Body length: ${emailData.body.length} characters`);

    // Enhance HTML typography
    const enhancedBody = enhanceEmailTypography(emailData.body);

    // Cleanup provider resources if needed
    if (cleanup) {
      await cleanup();
      console.log(`🧹 AI provider resources cleaned up`);
    }

    return {
      subject: emailData.subject,
      body: enhancedBody,
      preview: emailData.preview || emailData.subject,
    };

  } catch (error: any) {
    console.error(`❌ Error generating system update email:`, error);
    throw new Error(`Failed to generate system update email: ${error.message}`);
  }
}