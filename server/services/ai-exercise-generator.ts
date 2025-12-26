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
  languageMode?: 'course' | 'specific' | 'custom';
  specificLanguage?: string;
  customSystemPrompt?: string;
  writingStyle?: 'elementary' | 'standard' | 'professional' | 'academic' | 'custom';
  customWritingStyle?: string;
  questionsMode?: 'auto' | 'fixed';
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

interface ParsedExercise {
  lessonId: string;
  name: string;
  description: string;
  instructions: string;
  estimatedDuration: number;
  priority: 'low' | 'medium' | 'high';
  questions: AIGeneratedQuestion[];
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
    icon: 'GraduationCap',
    color: 'indigo',
    sortOrder: 0,
    isActive: true,
    isCourse: true,
    createdBy: consultantId,
  }).returning();

  console.log(`✅ [AI-EXERCISE] Created new category: "${newCategory.name}" (${newCategory.id})`);
  return { slug: newCategory.slug, id: newCategory.id };
}

function convertAIQuestionToSchemaQuestion(aiQuestion: AIGeneratedQuestion): Question {
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
    points: 10,
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

function getWritingStyleGuide(style: string, customStyle?: string): string {
  const styleGuides: Record<string, string> = {
    elementary: "Usa un linguaggio semplice come per un bambino di 10 anni. Frasi corte, parole semplici, concetti spiegati in modo elementare. Evita termini tecnici o complessi. Usa esempi concreti e familiari.",
    standard: "Usa un linguaggio chiaro e bilanciato, accessibile ma preciso. Mantieni un tono neutro e professionale senza essere troppo formale o troppo informale.",
    professional: "Usa terminologia tecnica appropriata, tono formale e professionale. Struttura le domande in modo rigoroso e preciso. Utilizza il linguaggio del settore.",
    academic: "Usa linguaggio accademico di livello universitario, con analisi approfondita e riferimenti teorici. Struttura complessa, terminologia specialistica, richiedi ragionamento critico e sintesi.",
  };

  if (style === 'custom' && customStyle) {
    return customStyle;
  }

  return styleGuides[style] || styleGuides.standard;
}

function getLanguageGuide(options: GenerateExercisesOptions): string {
  if (options.languageMode === 'custom' && options.customSystemPrompt) {
    return options.customSystemPrompt;
  }
  
  if (options.languageMode === 'specific' && options.specificLanguage) {
    const langMap: Record<string, string> = {
      it: 'italiano',
      en: 'inglese',
      es: 'spagnolo',
      fr: 'francese',
      de: 'tedesco',
      pt: 'portoghese',
    };
    const langName = langMap[options.specificLanguage] || options.specificLanguage;
    return `Tutte le domande, risposte, spiegazioni e istruzioni devono essere scritte in ${langName.toUpperCase()}.`;
  }
  
  return "Tutte le domande, risposte, spiegazioni e istruzioni devono essere scritte in ITALIANO.";
}

function buildExercisePromptForLesson(
  lesson: { id: string; title: string; content: string | null },
  options: GenerateExercisesOptions,
  lessonIndex: number
): string {
  const difficulty = options.difficulty || 'base';
  const questionsPerLesson = options.questionsPerLesson || 3;
  const questionMix = options.questionMix || {
    text: 20,
    multiple_choice: 40,
    true_false: 20,
    multiple_answer: 20,
  };
  const writingStyle = options.writingStyle || 'standard';
  const questionsMode = options.questionsMode || 'fixed';

  const difficultyGuide = {
    base: "domande semplici e dirette che verificano la comprensione dei concetti fondamentali",
    intermedio: "domande che richiedono ragionamento e applicazione pratica dei concetti",
    avanzato: "domande complesse che richiedono analisi critica, sintesi e problem-solving"
  };

  const contentPreview = lesson.content 
    ? lesson.content.replace(/<[^>]+>/g, ' ').substring(0, 5000) 
    : 'Contenuto non disponibile';

  const languageGuide = getLanguageGuide(options);
  const writingStyleGuide = getWritingStyleGuide(writingStyle, options.customWritingStyle);

  let questionsInstruction = '';
  if (questionsMode === 'auto') {
    questionsInstruction = `
- Analizza la lunghezza e la complessità del contenuto della lezione
- Determina autonomamente il numero ottimale di domande (minimo 1, massimo 15)
- Per contenuti brevi/semplici: 1-3 domande
- Per contenuti medi: 4-7 domande
- Per contenuti lunghi/complessi: 8-15 domande`;
  } else {
    questionsInstruction = `- Genera esattamente ${questionsPerLesson} domande`;
  }

  return `Sei un esperto nella creazione di esercizi formativi. Devi generare un esercizio basato su UNA SINGOLA lezione.

## LINGUA E STILE:
${languageGuide}

## STILE DI SCRITTURA:
${writingStyleGuide}

## LEZIONE DA ELABORARE:
### LEZIONE ${lessonIndex + 1}: "${lesson.title}" (ID: ${lesson.id})
${contentPreview}

## REQUISITI:
- Livello di difficoltà: ${difficulty.toUpperCase()} - ${difficultyGuide[difficulty]}
${questionsInstruction}
- Distribuzione tipi di domande (approssimativa):
  * open_ended (risposta aperta): ${questionMix.text}%
  * multiple_choice (scelta singola): ${questionMix.multiple_choice}%
  * true_false (vero/falso): ${questionMix.true_false}%
  * multiple_answer (scelta multipla): ${questionMix.multiple_answer}%

## FORMATO OUTPUT:
Rispondi SOLO con un JSON object valido (senza markdown, senza backticks). L'oggetto rappresenta l'esercizio per questa lezione:

{
  "lessonId": "${lesson.id}",
  "name": "Titolo dell'esercizio (max 60 caratteri)",
  "description": "Breve descrizione dell'esercizio",
  "instructions": "Istruzioni dettagliate per completare l'esercizio",
  "estimatedDuration": numero_minuti,
  "priority": "low" | "medium" | "high",
  "questions": [
    {
      "id": "stringa_unica_8_caratteri",
      "type": "multiple_choice",
      "prompt": "Testo della domanda",
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

## REGOLE IMPORTANTI:
1. Il "lessonId" DEVE essere esattamente: "${lesson.id}"
2. Ogni "id" delle domande deve essere una stringa unica di 8 caratteri alfanumerici
3. Per "multiple_choice" deve esserci ESATTAMENTE 1 opzione corretta
4. Per "true_false" le opzioni sono sempre [{"text":"Vero","isCorrect":X},{"text":"Falso","isCorrect":!X}]
5. Per "multiple_answer" ci possono essere 2+ opzioni corrette
6. Le domande devono essere chiare, non ambigue e pertinenti al contenuto della lezione
7. La "explanation" deve aiutare lo studente a capire la risposta corretta

Genera ora l'esercizio:`;
}

function parseSingleExerciseResponse(response: string, lessonId: string): ParsedExercise | null {
  let cleanJson = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  cleanJson = cleanJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  const startIdx = cleanJson.indexOf('{');
  const endIdx = cleanJson.lastIndexOf('}');
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanJson = cleanJson.substring(startIdx, endIdx + 1);
  }

  try {
    const item = JSON.parse(cleanJson);
    
    if (!item || typeof item !== 'object') {
      console.error('❌ [AI-EXERCISE] Response is not an object');
      return null;
    }

    const questions = Array.isArray(item.questions) 
      ? item.questions.filter((q: any) => {
          if (!q || typeof q !== 'object') {
            console.warn(`⚠️ [AI-EXERCISE] Invalid question: not an object`);
            return false;
          }
          if (!q.prompt || typeof q.prompt !== 'string') {
            console.warn(`⚠️ [AI-EXERCISE] Question missing prompt`);
            return false;
          }
          if (!q.type || !['open_ended', 'text', 'number', 'multiple_choice', 'true_false', 'multiple_answer'].includes(q.type)) {
            console.warn(`⚠️ [AI-EXERCISE] Invalid question type "${q.type}"`);
            return false;
          }
          return true;
        })
      : [];

    return {
      lessonId: item.lessonId || lessonId,
      name: item.name || 'Esercizio senza titolo',
      description: item.description || '',
      instructions: item.instructions || '',
      estimatedDuration: typeof item.estimatedDuration === 'number' ? item.estimatedDuration : 15,
      priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
      questions: questions,
    };
  } catch (error: any) {
    console.error('❌ [AI-EXERCISE] JSON parsing error:', error.message || error);
    console.log('📝 [AI-EXERCISE] Raw response (first 1000 chars):', cleanJson.substring(0, 1000));
    return null;
  }
}

async function generateExerciseForSingleLesson(params: {
  lesson: { id: string; title: string; content: string | null };
  options: GenerateExercisesOptions;
  lessonIndex: number;
  providerClient: any;
  selectedModel: string;
  useThinking: boolean;
  categorySlug: string;
}): Promise<GeneratedExerciseTemplate | null> {
  const { lesson, options, lessonIndex, providerClient, selectedModel, useThinking, categorySlug } = params;

  try {
    console.log(`📖 [AI-EXERCISE] Processing lesson ${lessonIndex + 1}: "${lesson.title}" (${lesson.id})`);

    const prompt = buildExercisePromptForLesson(lesson, options, lessonIndex);
    console.log(`📝 [AI-EXERCISE] Prompt length for lesson ${lessonIndex + 1}: ${prompt.length} characters`);

    const startTime = Date.now();
    const generateConfig: any = {
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8000,
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

    const response = await providerClient.generateContent(generateConfig);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    const generatedText = response.response.text() || '';
    console.log(`✅ [AI-EXERCISE] AI response for lesson ${lessonIndex + 1} received in ${elapsedTime}s (${generatedText.length} characters)`);

    const parsedExercise = parseSingleExerciseResponse(generatedText, lesson.id);

    if (!parsedExercise) {
      console.log(`❌ [AI-EXERCISE] Failed to parse AI response for lesson ${lessonIndex + 1}`);
      return null;
    }

    const questions: Question[] = parsedExercise.questions.map(q => convertAIQuestionToSchemaQuestion(q));

    const template: GeneratedExerciseTemplate = {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      name: parsedExercise.name,
      description: parsedExercise.description,
      instructions: parsedExercise.instructions,
      category: categorySlug,
      sortOrder: lessonIndex + 1,
      estimatedDuration: parsedExercise.estimatedDuration,
      priority: parsedExercise.priority,
      questions: questions,
    };

    console.log(`✅ [AI-EXERCISE] Generated template for lesson "${lesson.title}" with ${questions.length} questions`);
    return template;
  } catch (error: any) {
    console.error(`❌ [AI-EXERCISE] Error processing lesson ${lessonIndex + 1}:`, error.message || error);
    return null;
  }
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

function parseExerciseResponse(response: string, lessons: Array<{ id: string; title: string }>): Array<ParsedExercise> {
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

    const templates: GeneratedExerciseTemplate[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      console.log(`🔄 [AI-EXERCISE] Processing lesson ${i + 1}/${lessons.length}: "${lesson.title}"`);

      const template = await generateExerciseForSingleLesson({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
        },
        options,
        lessonIndex: i,
        providerClient: providerResult.client,
        selectedModel,
        useThinking,
        categorySlug,
      });

      if (template) {
        templates.push(template);
        successCount++;
        console.log(`✅ [AI-EXERCISE] Lesson ${i + 1}/${lessons.length} completed successfully`);
      } else {
        errorCount++;
        console.log(`⚠️ [AI-EXERCISE] Lesson ${i + 1}/${lessons.length} failed, continuing...`);
      }

      if (i < lessons.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`🎉 [AI-EXERCISE] Processing complete: ${successCount} success, ${errorCount} errors out of ${lessons.length} lessons`);

    if (templates.length === 0) {
      console.log(`❌ [AI-EXERCISE] No exercises were generated`);
      return { success: false, error: 'Nessun esercizio è stato generato' };
    }

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

// Progress callback type
interface ProgressInfo {
  lessonId: string;
  lessonTitle: string;
  lessonIndex: number;
  totalLessons: number;
  status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'error';
  questionsCount?: number;
  message?: string;
}

export async function generateExercisesForCourseWithProgress(params: {
  consultantId: string;
  courseId: string;
  options?: GenerateExercisesOptions;
  onProgress?: (progress: ProgressInfo) => void;
}): Promise<{ success: boolean; templates?: GeneratedExerciseTemplate[]; error?: string; categorySlug?: string }> {
  const { consultantId, courseId, options = {}, onProgress } = params;

  try {
    console.log(`🎯 [AI-EXERCISE-STREAM] Starting exercise generation with progress for course: ${courseId}`);
    console.log(`📊 [AI-EXERCISE-STREAM] Options: ${JSON.stringify(options)}`);

    const [course] = await db
      .select()
      .from(libraryCategories)
      .where(eq(libraryCategories.id, courseId));

    if (!course) {
      console.log(`❌ [AI-EXERCISE-STREAM] Course not found: ${courseId}`);
      return { success: false, error: 'Corso non trovato' };
    }

    console.log(`📚 [AI-EXERCISE-STREAM] Course found: "${course.name}"`);

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
      console.log(`🔍 [AI-EXERCISE-STREAM] Filtered to ${lessons.length} specific lessons`);
    }

    if (lessons.length === 0) {
      console.log(`❌ [AI-EXERCISE-STREAM] No lessons found for course`);
      return { success: false, error: 'Nessuna lezione trovata nel corso' };
    }

    console.log(`📖 [AI-EXERCISE-STREAM] Found ${lessons.length} lessons to process`);

    // Send initial pending status for all lessons
    if (onProgress) {
      for (let i = 0; i < lessons.length; i++) {
        onProgress({
          lessonId: lessons[i].id,
          lessonTitle: lessons[i].title,
          lessonIndex: i,
          totalLessons: lessons.length,
          status: 'pending',
          message: 'In attesa...',
        });
      }
    }

    const { slug: categorySlug } = await ensureCategoryExists(course.name, consultantId);

    console.log(`🤖 [AI-EXERCISE-STREAM] Getting AI provider for consultant: ${consultantId}`);
    const providerResult = await getAIProvider(consultantId);
    if (!providerResult.client) {
      console.log(`❌ [AI-EXERCISE-STREAM] AI provider not available`);
      return { success: false, error: 'Provider AI non disponibile' };
    }

    const { model: selectedModel, useThinking } = getModelWithThinking(providerResult.metadata.name);
    console.log(`🤖 [AI-EXERCISE-STREAM] Using model: ${selectedModel} (thinking: ${useThinking})`);

    const templates: GeneratedExerciseTemplate[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lessons.length; i++) {
      const lesson = lessons[i];
      console.log(`🔄 [AI-EXERCISE-STREAM] Processing lesson ${i + 1}/${lessons.length}: "${lesson.title}"`);

      // Send analyzing status
      if (onProgress) {
        onProgress({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonIndex: i,
          totalLessons: lessons.length,
          status: 'analyzing',
          message: 'Analisi contenuto...',
        });
      }

      // Short delay to show the analyzing state
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send generating status
      if (onProgress) {
        onProgress({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonIndex: i,
          totalLessons: lessons.length,
          status: 'generating',
          message: 'Generazione esercizi...',
        });
      }

      const template = await generateExerciseForSingleLesson({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          content: lesson.content,
        },
        options,
        lessonIndex: i,
        providerClient: providerResult.client,
        selectedModel,
        useThinking,
        categorySlug,
      });

      if (template) {
        templates.push(template);
        successCount++;
        console.log(`✅ [AI-EXERCISE-STREAM] Lesson ${i + 1}/${lessons.length} completed successfully`);
        
        // Send completed status
        if (onProgress) {
          onProgress({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonIndex: i,
            totalLessons: lessons.length,
            status: 'completed',
            questionsCount: template.questions.length,
            message: `${template.questions.length} domande create`,
          });
        }
      } else {
        errorCount++;
        console.log(`⚠️ [AI-EXERCISE-STREAM] Lesson ${i + 1}/${lessons.length} failed, continuing...`);
        
        // Send error status
        if (onProgress) {
          onProgress({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonIndex: i,
            totalLessons: lessons.length,
            status: 'error',
            message: 'Errore nella generazione',
          });
        }
      }

      // Delay between lessons to avoid rate limiting
      if (i < lessons.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`🎉 [AI-EXERCISE-STREAM] Processing complete: ${successCount} success, ${errorCount} errors out of ${lessons.length} lessons`);

    if (templates.length === 0) {
      console.log(`❌ [AI-EXERCISE-STREAM] No exercises were generated`);
      return { success: false, error: 'Nessun esercizio è stato generato' };
    }

    console.log(`🎉 [AI-EXERCISE-STREAM] Successfully generated ${templates.length} exercise templates`);
    
    return {
      success: true,
      templates,
      categorySlug,
    };
  } catch (error: any) {
    console.error(`❌ [AI-EXERCISE-STREAM] Error:`, error.message || error);
    return { success: false, error: error.message || 'Errore nella generazione degli esercizi' };
  }
}
