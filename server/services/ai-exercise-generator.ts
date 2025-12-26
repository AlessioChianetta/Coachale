import { db } from "../db";
import { libraryDocuments, libraryCategories, exerciseCategories } from "../../shared/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { getAIProvider, getModelWithThinking, GEMINI_3_THINKING_LEVEL } from "../ai/provider-factory";
import { nanoid } from "nanoid";
import type { Question } from "../../shared/schema";

interface GenerateExercisesOptions {
  lessonIds?: string[];
  difficulty?: 'base' | 'intermedio' | 'avanzato';
  questionsPerLesson?: number;
  questionMix?: {
    text: number;
    multiple_choice: number;
    true_false: number;
    multiple_answer: number;
  };
}

interface GeneratedExerciseTemplate {
  lessonId: string;
  lessonTitle: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  sortOrder: number;
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
  questions: Question[];
}

interface AIGeneratedQuestion {
  id: string;
  type: 'open_ended' | 'text' | 'number' | 'multiple_choice' | 'true_false' | 'multiple_answer';
  prompt: string;
  options?: Array<{ text: string; isCorrect: boolean }>;
  correctAnswer?: string;
  explanation?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function ensureCategoryExists(courseName: string, consultantId: string): Promise<{ slug: string; id: string }> {
  const slug = slugify(courseName);
  console.log(`📂 [AI-EXERCISE] Looking for exercise category with slug: "${slug}"`);

  const [existingCategory] = await db
    .select()
    .from(exerciseCategories)
    .where(eq(exerciseCategories.slug, slug));

  if (existingCategory) {
    console.log(`✅ [AI-EXERCISE] Found existing category: "${existingCategory.name}" (${existingCategory.id})`);
    return { slug: existingCategory.slug, id: existingCategory.id };
  }

  console.log(`📝 [AI-EXERCISE] Creating new exercise category: "${courseName}"`);
  const [newCategory] = await db.insert(exerciseCategories).values({
    name: courseName,
    slug: slug,
    description: `Esercizi generati automaticamente dal corso "${courseName}"`,
    icon: 'BookOpen',
    color: 'purple',
    sortOrder: 0,
    isActive: true,
    createdBy: consultantId,
  }).returning();

  console.log(`✅ [AI-EXERCISE] Created new category: "${newCategory.name}" (${newCategory.id})`);
  return { slug: newCategory.slug, id: newCategory.id };
}

function convertAIQuestionToSchemaQuestion(aiQuestion: AIGeneratedQuestion): Question {
  // Map AI types to schema types - "text" and "number" map to "open_ended"
  const typeMapping: Record<string, Question['type']> = {
    'open_ended': 'open_ended',
    'text': 'open_ended',
    'number': 'open_ended',
    'multiple_choice': 'multiple_choice',
    'true_false': 'true_false',
    'multiple_answer': 'multiple_answer',
  };

  const question: Question = {
    id: aiQuestion.id || nanoid(),
    question: aiQuestion.prompt,
    type: typeMapping[aiQuestion.type] || 'open_ended',
    explanation: aiQuestion.explanation || '',
    points: 10, // Default points
  };

  if (aiQuestion.options && aiQuestion.options.length > 0) {
    question.options = aiQuestion.options.map(opt => opt.text);
    question.correctAnswers = aiQuestion.options
      .filter(opt => opt.isCorrect)
      .map(opt => opt.text);
  }

  if (aiQuestion.correctAnswer) {
    question.correctAnswers = [aiQuestion.correctAnswer];
  }

  return question;
}

function buildExercisePrompt(
  lessons: Array<{ id: string; title: string; content: string | null }>,
  options: GenerateExercisesOptions
): string {
  const difficulty = options.difficulty || 'base';
  const questionsPerLesson = options.questionsPerLesson || 3;
  const questionMix = options.questionMix || {
    text: 20,
    multiple_choice: 40,
    true_false: 20,
    multiple_answer: 20,
  };

  const difficultyGuide = {
    base: "domande semplici e dirette che verificano la comprensione dei concetti fondamentali",
    intermedio: "domande che richiedono ragionamento e applicazione pratica dei concetti",
    avanzato: "domande complesse che richiedono analisi critica, sintesi e problem-solving"
  };

  const lessonsContext = lessons.map((lesson, idx) => {
    const contentPreview = lesson.content 
      ? lesson.content.replace(/<[^>]+>/g, ' ').substring(0, 3000) 
      : 'Contenuto non disponibile';
    return `
### LEZIONE ${idx + 1}: "${lesson.title}" (ID: ${lesson.id})
${contentPreview}
---`;
  }).join('\n');

  return `Sei un esperto nella creazione di esercizi formativi. Devi generare esercizi basati sulle lezioni di un corso.

## LEZIONI DEL CORSO:
${lessonsContext}

## REQUISITI:
- Livello di difficoltà: ${difficulty.toUpperCase()} - ${difficultyGuide[difficulty]}
- Genera esattamente ${questionsPerLesson} domande per ogni lezione
- Distribuzione tipi di domande (approssimativa):
  * open_ended (risposta aperta): ${questionMix.text}%
  * multiple_choice (scelta singola): ${questionMix.multiple_choice}%
  * true_false (vero/falso): ${questionMix.true_false}%
  * multiple_answer (scelta multipla): ${questionMix.multiple_answer}%

## FORMATO OUTPUT:
Rispondi SOLO con un JSON array valido (senza markdown, senza backticks). Ogni elemento rappresenta un esercizio per una lezione:

[
  {
    "lessonId": "id_della_lezione",
    "name": "Titolo dell'esercizio (max 60 caratteri)",
    "description": "Breve descrizione dell'esercizio",
    "instructions": "Istruzioni dettagliate per completare l'esercizio",
    "estimatedDuration": numero_minuti,
    "priority": "low" | "medium" | "high",
    "questions": [
      {
        "id": "stringa_unica_8_caratteri",
        "type": "multiple_choice",
        "prompt": "Testo della domanda in italiano",
        "options": [
          {"text": "Opzione A", "isCorrect": false},
          {"text": "Opzione B", "isCorrect": true},
          {"text": "Opzione C", "isCorrect": false},
          {"text": "Opzione D", "isCorrect": false}
        ],
        "explanation": "Spiegazione della risposta corretta"
      },
      {
        "id": "stringa_unica_8_caratteri",
        "type": "true_false",
        "prompt": "Affermazione da valutare come vera o falsa",
        "options": [
          {"text": "Vero", "isCorrect": true},
          {"text": "Falso", "isCorrect": false}
        ],
        "explanation": "Spiegazione del perché è vero/falso"
      },
      {
        "id": "stringa_unica_8_caratteri",
        "type": "open_ended",
        "prompt": "Domanda a risposta aperta",
        "correctAnswer": "Risposta corretta attesa (keywords principali)",
        "explanation": "Spiegazione e criteri di valutazione"
      },
      {
        "id": "stringa_unica_8_caratteri",
        "type": "multiple_answer",
        "prompt": "Domanda con più risposte corrette",
        "options": [
          {"text": "Opzione A", "isCorrect": true},
          {"text": "Opzione B", "isCorrect": false},
          {"text": "Opzione C", "isCorrect": true},
          {"text": "Opzione D", "isCorrect": false}
        ],
        "explanation": "Spiegazione delle risposte corrette"
      }
    ]
  }
]

## REGOLE IMPORTANTI:
1. Genera esattamente un oggetto per ogni lezione fornita
2. Ogni "id" deve essere una stringa unica di 8 caratteri alfanumerici
3. Per "multiple_choice" deve esserci ESATTAMENTE 1 opzione corretta
4. Per "true_false" le opzioni sono sempre [{"text":"Vero","isCorrect":X},{"text":"Falso","isCorrect":!X}]
5. Per "multiple_answer" ci possono essere 2+ opzioni corrette
6. Tutte le domande e risposte devono essere in ITALIANO
7. Le domande devono essere chiare, non ambigue e pertinenti al contenuto della lezione
8. La "explanation" deve aiutare lo studente a capire la risposta corretta

Genera ora gli esercizi:`;
}

function parseExerciseResponse(response: string, lessons: Array<{ id: string; title: string }>): Array<{
  lessonId: string;
  name: string;
  description: string;
  instructions: string;
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
  questions: AIGeneratedQuestion[];
}> {
  let cleanJson = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  cleanJson = cleanJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const startIdx = cleanJson.indexOf('[');
  const endIdx = cleanJson.lastIndexOf(']');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanJson = cleanJson.substring(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(cleanJson);
    
    if (!Array.isArray(parsed)) {
      console.error('❌ [AI-EXERCISE] Response is not an array');
      console.log('📝 [AI-EXERCISE] Parsed type:', typeof parsed);
      return [];
    }

    const validatedItems = parsed.map((item, index) => {
      if (!item || typeof item !== 'object') {
        console.warn(`⚠️ [AI-EXERCISE] Invalid item at index ${index}: not an object`);
        return null;
      }

      const questions = Array.isArray(item.questions) 
        ? item.questions.filter((q: any) => {
            if (!q || typeof q !== 'object') {
              console.warn(`⚠️ [AI-EXERCISE] Invalid question in exercise ${index}: not an object`);
              return false;
            }
            if (!q.prompt || typeof q.prompt !== 'string') {
              console.warn(`⚠️ [AI-EXERCISE] Question missing prompt in exercise ${index}`);
              return false;
            }
            if (!q.type || !['open_ended', 'text', 'number', 'multiple_choice', 'true_false', 'multiple_answer'].includes(q.type)) {
              console.warn(`⚠️ [AI-EXERCISE] Invalid question type "${q.type}" in exercise ${index}`);
              return false;
            }
            return true;
          })
        : [];

      return {
        lessonId: item.lessonId || '',
        name: item.name || 'Esercizio senza titolo',
        description: item.description || '',
        instructions: item.instructions || '',
        estimatedDuration: typeof item.estimatedDuration === 'number' ? item.estimatedDuration : 15,
        priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
        questions: questions,
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    console.log(`✅ [AI-EXERCISE] Validated ${validatedItems.length}/${parsed.length} exercises`);
    return validatedItems;
  } catch (error: any) {
    console.error('❌ [AI-EXERCISE] JSON parsing error:', error.message || error);
    console.log('📝 [AI-EXERCISE] Raw response (first 1000 chars):', cleanJson.substring(0, 1000));
    console.log('📝 [AI-EXERCISE] Raw response (last 500 chars):', cleanJson.substring(Math.max(0, cleanJson.length - 500)));
    return [];
  }
}

export async function generateExercisesForCourse(params: {
  consultantId: string;
  courseId: string;
  options?: GenerateExercisesOptions;
}): Promise<{ success: boolean; templates?: GeneratedExerciseTemplate[]; error?: string; categorySlug?: string }> {
  const { consultantId, courseId, options = {} } = params;

  try {
    console.log(`🎯 [AI-EXERCISE] Starting exercise generation for course: ${courseId}`);
    console.log(`📊 [AI-EXERCISE] Options: ${JSON.stringify(options)}`);

    const [course] = await db
      .select()
      .from(libraryCategories)
      .where(eq(libraryCategories.id, courseId));

    if (!course) {
      console.log(`❌ [AI-EXERCISE] Course not found: ${courseId}`);
      return { success: false, error: 'Corso non trovato' };
    }

    console.log(`📚 [AI-EXERCISE] Course found: "${course.name}"`);

    let lessonsQuery = db
      .select()
      .from(libraryDocuments)
      .where(
        and(
          eq(libraryDocuments.categoryId, courseId),
          eq(libraryDocuments.isPublished, true)
        )
      )
      .orderBy(asc(libraryDocuments.sortOrder), asc(libraryDocuments.createdAt));

    let lessons = await lessonsQuery;

    if (options.lessonIds && options.lessonIds.length > 0) {
      lessons = lessons.filter(l => options.lessonIds!.includes(l.id));
      console.log(`🔍 [AI-EXERCISE] Filtered to ${lessons.length} specific lessons`);
    }

    if (lessons.length === 0) {
      console.log(`❌ [AI-EXERCISE] No lessons found for course`);
      return { success: false, error: 'Nessuna lezione trovata nel corso' };
    }

    console.log(`📖 [AI-EXERCISE] Found ${lessons.length} lessons to process`);

    const { slug: categorySlug } = await ensureCategoryExists(course.name, consultantId);

    console.log(`🤖 [AI-EXERCISE] Getting AI provider for consultant: ${consultantId}`);
    const providerResult = await getAIProvider(consultantId);
    if (!providerResult.client) {
      console.log(`❌ [AI-EXERCISE] AI provider not available`);
      return { success: false, error: 'Provider AI non disponibile' };
    }

    const { model: selectedModel, useThinking } = getModelWithThinking(providerResult.metadata.name);
    console.log(`🤖 [AI-EXERCISE] Using model: ${selectedModel} (thinking: ${useThinking})`);

    const lessonsForPrompt = lessons.map(l => ({
      id: l.id,
      title: l.title,
      content: l.content,
    }));

    const prompt = buildExercisePrompt(lessonsForPrompt, options);
    console.log(`📝 [AI-EXERCISE] Prompt length: ${prompt.length} characters`);

    const startTime = Date.now();
    const generateConfig: any = {
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 30000,
      }
    };

    if (useThinking) {
      generateConfig.config = {
        ...generateConfig.config,
        thinkingConfig: {
          thinkingMode: "enabled",
          thinkingBudget: GEMINI_3_THINKING_LEVEL === "high" ? 16000 :
                          GEMINI_3_THINKING_LEVEL === "medium" ? 8000 :
                          GEMINI_3_THINKING_LEVEL === "low" ? 4000 : 2000,
        }
      };
    }

    console.log(`📝 [AI-EXERCISE] Sending request to AI...`);
    const response = await providerResult.client.generateContent(generateConfig);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    const generatedText = response.response.text() || '';
    console.log(`✅ [AI-EXERCISE] AI response received in ${elapsedTime}s (${generatedText.length} characters)`);

    const lessonMap = new Map(lessons.map(l => [l.id, l.title]));
    const parsedExercises = parseExerciseResponse(generatedText, lessons.map(l => ({ id: l.id, title: l.title })));

    if (parsedExercises.length === 0) {
      console.log(`❌ [AI-EXERCISE] Failed to parse AI response`);
      return { success: false, error: 'Errore nel parsing della risposta AI' };
    }

    console.log(`✅ [AI-EXERCISE] Parsed ${parsedExercises.length} exercise templates`);

    const templates: GeneratedExerciseTemplate[] = parsedExercises.map((exercise, idx) => {
      const lessonTitle = lessonMap.get(exercise.lessonId) || 'Lezione sconosciuta';
      
      const questions: Question[] = exercise.questions.map(q => convertAIQuestionToSchemaQuestion(q));

      return {
        lessonId: exercise.lessonId,
        lessonTitle: lessonTitle,
        name: exercise.name,
        description: exercise.description,
        instructions: exercise.instructions,
        category: categorySlug,
        sortOrder: idx + 1,
        estimatedDuration: exercise.estimatedDuration,
        priority: exercise.priority,
        questions: questions,
      };
    });

    console.log(`🎉 [AI-EXERCISE] Successfully generated ${templates.length} exercise templates`);
    
    return {
      success: true,
      templates,
      categorySlug,
    };
  } catch (error: any) {
    console.error(`❌ [AI-EXERCISE] Error:`, error.message || error);
    return { success: false, error: error.message || 'Errore nella generazione degli esercizi' };
  }
}
