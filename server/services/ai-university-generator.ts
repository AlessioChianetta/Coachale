import { db } from "../db";
import {
  libraryDocuments,
  libraryCategories,
  universityTemplates,
  templateTrimesters,
  templateModules,
  templateLessons,
  universityYears,
  universityTrimesters,
  universityModules,
  universityLessons,
  universityYearClientAssignments,
  exercises,
} from "../../shared/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { getAIProvider, getModelWithThinking, GEMINI_3_THINKING_LEVEL } from "../ai/provider-factory";

interface CourseInfo {
  id: string;
  name: string;
  description: string;
  lessonCount: number;
  lessons: Array<{
    id: string;
    title: string;
    description: string | null;
    level: string;
    contentPreview: string;
  }>;
}

interface TrimesterAssignment {
  courseId: string;
  courseName: string;
  trimester: "Q1" | "Q2" | "Q3" | "Q4";
  reasoning: string;
  sortOrder: number;
}

interface CourseAssignment {
  courseId: string;
  trimester: "Q1" | "Q2" | "Q3" | "Q4";
  sortOrder?: number;
}

interface GeneratedPathway {
  templateId: string;
  name: string;
  trimesters: Array<{
    id: string;
    title: string;
    modules: Array<{
      id: string;
      title: string;
      courseId: string;
      lessons: Array<{
        id: string;
        title: string;
        libraryDocumentId: string;
        exerciseId: string | null;
      }>;
    }>;
  }>;
}

interface InstantiatedYear {
  yearId: string;
  clientAssignments: Array<{
    clientId: string;
    assignmentId: string;
  }>;
  trimesters: Array<{
    id: string;
    title: string;
    modules: Array<{
      id: string;
      title: string;
      lessons: Array<{
        id: string;
        title: string;
      }>;
    }>;
  }>;
}

async function getCoursesForConsultant(consultantId: string, courseIds?: string[]): Promise<CourseInfo[]> {
  console.log(`📚 [AI-UNIVERSITY] Fetching courses for consultant: ${consultantId}`);

  let categoriesQuery = db
    .select()
    .from(libraryCategories)
    .where(
      and(
        eq(libraryCategories.createdBy, consultantId),
        eq(libraryCategories.isActive, true)
      )
    )
    .orderBy(asc(libraryCategories.sortOrder));

  let categories = await categoriesQuery;

  if (courseIds && courseIds.length > 0) {
    categories = categories.filter(c => courseIds.includes(c.id));
    console.log(`🔍 [AI-UNIVERSITY] Filtered to ${categories.length} specific courses`);
  }

  const courses: CourseInfo[] = [];

  for (const category of categories) {
    const lessons = await db
      .select()
      .from(libraryDocuments)
      .where(
        and(
          eq(libraryDocuments.categoryId, category.id),
          eq(libraryDocuments.isPublished, true)
        )
      )
      .orderBy(asc(libraryDocuments.sortOrder), asc(libraryDocuments.createdAt));

    if (lessons.length === 0) {
      console.log(`⚠️ [AI-UNIVERSITY] Course "${category.name}" has no lessons, skipping`);
      continue;
    }

    courses.push({
      id: category.id,
      name: category.name,
      description: category.description || "",
      lessonCount: lessons.length,
      lessons: lessons.map(l => ({
        id: l.id,
        title: l.title,
        description: l.description,
        level: l.level || "base",
        contentPreview: l.content
          ? l.content.replace(/<[^>]+>/g, " ").substring(0, 500)
          : "Contenuto non disponibile",
      })),
    });
  }

  console.log(`✅ [AI-UNIVERSITY] Found ${courses.length} courses with lessons`);
  return courses;
}

function buildTrimesterAssignmentPrompt(courses: CourseInfo[]): string {
  const coursesContext = courses.map((course, idx) => {
    const lessonsPreview = course.lessons
      .map((l, li) => `  ${li + 1}. "${l.title}" (Livello: ${l.level}) - ${l.contentPreview.substring(0, 200)}...`)
      .join("\n");

    return `
### CORSO ${idx + 1}: "${course.name}"
Descrizione: ${course.description || "Non disponibile"}
Numero lezioni: ${course.lessonCount}
Lezioni:
${lessonsPreview}
---`;
  }).join("\n");

  return `Sei un esperto in progettazione di percorsi formativi universitari. Devi analizzare i corsi forniti e suggerire in quale trimestre (Q1, Q2, Q3, Q4) inserire ciascun corso per creare un percorso formativo ottimale.

## CORSI DA ANALIZZARE:
${coursesContext}

## CRITERI DI ASSEGNAZIONE:
1. **Progressione della difficoltà**: Q1 dovrebbe contenere corsi fondamentali e introduttivi, Q4 corsi avanzati
2. **Dipendenze tra argomenti**: Corsi propedeutici devono precedere quelli che ne dipendono
3. **Progressione naturale dell'apprendimento**: Dal generale al particolare, dalla teoria alla pratica
4. **Bilanciamento del carico**: Distribuire equamente il numero di lezioni tra i trimestri

## STRUTTURA TRIMESTRI:
- Q1 (Primo Trimestre): Fondamenti, introduzione, concetti base
- Q2 (Secondo Trimestre): Sviluppo competenze, approfondimento base
- Q3 (Terzo Trimestre): Competenze intermedie, applicazione pratica
- Q4 (Quarto Trimestre): Competenze avanzate, specializzazione, casi studio

## FORMATO OUTPUT:
Rispondi SOLO con un JSON array valido (senza markdown, senza backticks):

[
  {
    "courseId": "id_del_corso",
    "courseName": "nome_del_corso",
    "trimester": "Q1" | "Q2" | "Q3" | "Q4",
    "reasoning": "Spiegazione breve del perché questo corso appartiene a questo trimestre",
    "sortOrder": numero_ordine_nel_trimestre
  }
]

## REGOLE IMPORTANTI:
1. Assegna OGNI corso a un solo trimestre
2. Il campo "trimester" deve essere esattamente "Q1", "Q2", "Q3" o "Q4"
3. Il campo "sortOrder" indica l'ordine del corso all'interno del trimestre (1, 2, 3, ...)
4. Il campo "reasoning" deve essere in italiano e breve (max 100 caratteri)
5. Considera il contenuto delle lezioni per determinare il livello di difficoltà

Genera ora le assegnazioni:`;
}

function parseTrimesterAssignmentResponse(
  response: string,
  courses: CourseInfo[]
): TrimesterAssignment[] {
  let cleanJson = response
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  cleanJson = cleanJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const startIdx = cleanJson.indexOf("[");
  const endIdx = cleanJson.lastIndexOf("]");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleanJson = cleanJson.substring(startIdx, endIdx + 1);
  }

  try {
    const parsed = JSON.parse(cleanJson);

    if (!Array.isArray(parsed)) {
      console.error("❌ [AI-UNIVERSITY] Response is not an array");
      return [];
    }

    const courseMap = new Map(courses.map(c => [c.id, c.name]));
    const validTrimesters = ["Q1", "Q2", "Q3", "Q4"];

    const validatedItems = parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          console.warn(`⚠️ [AI-UNIVERSITY] Invalid item at index ${index}`);
          return null;
        }

        if (!item.courseId || !courseMap.has(item.courseId)) {
          console.warn(`⚠️ [AI-UNIVERSITY] Invalid courseId at index ${index}`);
          return null;
        }

        if (!validTrimesters.includes(item.trimester)) {
          console.warn(`⚠️ [AI-UNIVERSITY] Invalid trimester "${item.trimester}" at index ${index}`);
          return null;
        }

        return {
          courseId: item.courseId,
          courseName: item.courseName || courseMap.get(item.courseId) || "Corso sconosciuto",
          trimester: item.trimester as "Q1" | "Q2" | "Q3" | "Q4",
          reasoning: item.reasoning || "",
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 1,
        };
      })
      .filter((item): item is TrimesterAssignment => item !== null);

    console.log(`✅ [AI-UNIVERSITY] Validated ${validatedItems.length}/${parsed.length} assignments`);
    return validatedItems;
  } catch (error: any) {
    console.error("❌ [AI-UNIVERSITY] JSON parsing error:", error.message);
    console.log("📝 [AI-UNIVERSITY] Raw response (first 1000 chars):", cleanJson.substring(0, 1000));
    return [];
  }
}

export async function analyzeCoursesForTrimesterAssignment(
  consultantId: string,
  courseIds?: string[]
): Promise<{
  success: boolean;
  assignments?: TrimesterAssignment[];
  error?: string;
}> {
  try {
    console.log(`🎯 [AI-UNIVERSITY] Starting trimester assignment analysis for consultant: ${consultantId}`);

    const courses = await getCoursesForConsultant(consultantId, courseIds);

    if (courses.length === 0) {
      return { success: false, error: "Nessun corso trovato con lezioni" };
    }

    console.log(`📊 [AI-UNIVERSITY] Analyzing ${courses.length} courses`);

    const providerResult = await getAIProvider(consultantId);
    if (!providerResult.client) {
      return { success: false, error: "Provider AI non disponibile" };
    }

    const { model: selectedModel, useThinking } = getModelWithThinking(providerResult.metadata.name);
    console.log(`🤖 [AI-UNIVERSITY] Using model: ${selectedModel} (thinking: ${useThinking})`);

    const prompt = buildTrimesterAssignmentPrompt(courses);
    console.log(`📝 [AI-UNIVERSITY] Prompt length: ${prompt.length} characters`);

    const startTime = Date.now();
    const generateConfig: any = {
      model: selectedModel,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 8000,
      },
    };

    if (useThinking) {
      generateConfig.config = {
        ...generateConfig.config,
        thinkingConfig: {
          thinkingMode: "enabled",
          thinkingBudget:
            GEMINI_3_THINKING_LEVEL === "high" ? 16000 :
            GEMINI_3_THINKING_LEVEL === "medium" ? 8000 :
            GEMINI_3_THINKING_LEVEL === "low" ? 4000 : 2000,
        },
      };
    }

    console.log(`📝 [AI-UNIVERSITY] Sending request to AI...`);
    const response = await providerResult.client.generateContent(generateConfig);
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    const generatedText = response.response.text() || "";
    console.log(`✅ [AI-UNIVERSITY] AI response received in ${elapsedTime}s (${generatedText.length} characters)`);

    const assignments = parseTrimesterAssignmentResponse(generatedText, courses);

    if (assignments.length === 0) {
      return { success: false, error: "Errore nel parsing della risposta AI" };
    }

    console.log(`🎉 [AI-UNIVERSITY] Successfully analyzed ${assignments.length} course assignments`);
    return { success: true, assignments };
  } catch (error: any) {
    console.error(`❌ [AI-UNIVERSITY] Error:`, error.message || error);
    return { success: false, error: error.message || "Errore nell'analisi dei corsi" };
  }
}

async function findExerciseForLesson(lessonId: string): Promise<string | null> {
  const [exercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.libraryDocumentId, lessonId))
    .limit(1);

  return exercise?.id || null;
}

export async function generateUniversityPathway(
  consultantId: string,
  pathwayName: string,
  courseAssignments: CourseAssignment[]
): Promise<{
  success: boolean;
  pathway?: GeneratedPathway;
  error?: string;
}> {
  try {
    console.log(`🎯 [AI-UNIVERSITY] Generating pathway "${pathwayName}" for consultant: ${consultantId}`);
    console.log(`📊 [AI-UNIVERSITY] Course assignments: ${courseAssignments.length}`);

    if (courseAssignments.length === 0) {
      return { success: false, error: "Nessuna assegnazione di corso fornita" };
    }

    const [template] = await db
      .insert(universityTemplates)
      .values({
        name: pathwayName,
        description: `Percorso formativo generato automaticamente con ${courseAssignments.length} corsi`,
        isActive: true,
        createdBy: consultantId,
      })
      .returning();

    console.log(`✅ [AI-UNIVERSITY] Created template: ${template.id}`);

    const trimesterMap: Record<string, { id: string; title: string; sortOrder: number }> = {};
    const trimesterOrder = ["Q1", "Q2", "Q3", "Q4"];

    for (let i = 0; i < 4; i++) {
      const trimesterKey = trimesterOrder[i];
      const trimesterTitle = `Q${i + 1} – ${getTrimesterTitle(i + 1)}`;

      const [trimester] = await db
        .insert(templateTrimesters)
        .values({
          templateId: template.id,
          title: trimesterTitle,
          description: getTrimesterDescription(i + 1),
          sortOrder: i,
        })
        .returning();

      trimesterMap[trimesterKey] = {
        id: trimester.id,
        title: trimester.title,
        sortOrder: i,
      };

      console.log(`✅ [AI-UNIVERSITY] Created trimester: ${trimester.title}`);
    }

    const groupedAssignments: Record<string, CourseAssignment[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };

    for (const assignment of courseAssignments) {
      groupedAssignments[assignment.trimester].push(assignment);
    }

    for (const key of Object.keys(groupedAssignments)) {
      groupedAssignments[key].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    const pathwayTrimesters: GeneratedPathway["trimesters"] = [];

    for (const trimesterKey of trimesterOrder) {
      const trimesterInfo = trimesterMap[trimesterKey];
      const assignments = groupedAssignments[trimesterKey];
      const modules: GeneratedPathway["trimesters"][0]["modules"] = [];

      for (let moduleIdx = 0; moduleIdx < assignments.length; moduleIdx++) {
        const assignment = assignments[moduleIdx];

        const [category] = await db
          .select()
          .from(libraryCategories)
          .where(eq(libraryCategories.id, assignment.courseId));

        if (!category) {
          console.warn(`⚠️ [AI-UNIVERSITY] Course not found: ${assignment.courseId}`);
          continue;
        }

        const [module] = await db
          .insert(templateModules)
          .values({
            templateTrimesterId: trimesterInfo.id,
            title: category.name,
            description: category.description,
            sortOrder: moduleIdx,
          })
          .returning();

        console.log(`✅ [AI-UNIVERSITY] Created module: ${module.title}`);

        const lessons = await db
          .select()
          .from(libraryDocuments)
          .where(
            and(
              eq(libraryDocuments.categoryId, assignment.courseId),
              eq(libraryDocuments.isPublished, true)
            )
          )
          .orderBy(asc(libraryDocuments.sortOrder), asc(libraryDocuments.createdAt));

        const moduleLessons: GeneratedPathway["trimesters"][0]["modules"][0]["lessons"] = [];

        for (let lessonIdx = 0; lessonIdx < lessons.length; lessonIdx++) {
          const lesson = lessons[lessonIdx];
          const exerciseId = await findExerciseForLesson(lesson.id);

          const [templateLesson] = await db
            .insert(templateLessons)
            .values({
              templateModuleId: module.id,
              title: lesson.title,
              description: lesson.description,
              libraryDocumentId: lesson.id,
              exerciseId: exerciseId,
              sortOrder: lessonIdx,
            })
            .returning();

          moduleLessons.push({
            id: templateLesson.id,
            title: templateLesson.title,
            libraryDocumentId: lesson.id,
            exerciseId: exerciseId,
          });
        }

        console.log(`✅ [AI-UNIVERSITY] Created ${moduleLessons.length} lessons for module "${module.title}"`);

        modules.push({
          id: module.id,
          title: module.title,
          courseId: assignment.courseId,
          lessons: moduleLessons,
        });
      }

      pathwayTrimesters.push({
        id: trimesterInfo.id,
        title: trimesterInfo.title,
        modules,
      });
    }

    const pathway: GeneratedPathway = {
      templateId: template.id,
      name: template.name,
      trimesters: pathwayTrimesters,
    };

    const totalModules = pathwayTrimesters.reduce((acc, t) => acc + t.modules.length, 0);
    const totalLessons = pathwayTrimesters.reduce(
      (acc, t) => acc + t.modules.reduce((macc, m) => macc + m.lessons.length, 0),
      0
    );

    console.log(`🎉 [AI-UNIVERSITY] Successfully generated pathway with ${totalModules} modules and ${totalLessons} lessons`);

    return { success: true, pathway };
  } catch (error: any) {
    console.error(`❌ [AI-UNIVERSITY] Error:`, error.message || error);
    return { success: false, error: error.message || "Errore nella generazione del percorso" };
  }
}

function getTrimesterTitle(quarter: number): string {
  const titles: Record<number, string> = {
    1: "Fondamenti",
    2: "Sviluppo",
    3: "Applicazione",
    4: "Avanzato",
  };
  return titles[quarter] || "Trimestre";
}

function getTrimesterDescription(quarter: number): string {
  const descriptions: Record<number, string> = {
    1: "Costruzione delle basi teoriche e concetti fondamentali",
    2: "Sviluppo delle competenze e approfondimento",
    3: "Applicazione pratica e casi studio",
    4: "Competenze avanzate e specializzazione",
  };
  return descriptions[quarter] || "";
}

export async function instantiatePathwayForClients(
  templateId: string,
  consultantId: string,
  clientIds: string[]
): Promise<{
  success: boolean;
  instantiatedYear?: InstantiatedYear;
  error?: string;
}> {
  try {
    console.log(`🎯 [AI-UNIVERSITY] Instantiating pathway template ${templateId} for ${clientIds.length} clients`);

    const [template] = await db
      .select()
      .from(universityTemplates)
      .where(eq(universityTemplates.id, templateId));

    if (!template) {
      return { success: false, error: "Template non trovato" };
    }

    const templateTrimestersList = await db
      .select()
      .from(templateTrimesters)
      .where(eq(templateTrimesters.templateId, templateId))
      .orderBy(asc(templateTrimesters.sortOrder));

    const [year] = await db
      .insert(universityYears)
      .values({
        templateId: templateId,
        title: template.name,
        description: template.description,
        sortOrder: 0,
        isLocked: false,
        createdBy: consultantId,
      })
      .returning();

    console.log(`✅ [AI-UNIVERSITY] Created university year: ${year.id}`);

    const clientAssignments: InstantiatedYear["clientAssignments"] = [];

    for (const clientId of clientIds) {
      const [assignment] = await db
        .insert(universityYearClientAssignments)
        .values({
          yearId: year.id,
          clientId: clientId,
          consultantId: consultantId,
        })
        .returning();

      clientAssignments.push({
        clientId: clientId,
        assignmentId: assignment.id,
      });
    }

    console.log(`✅ [AI-UNIVERSITY] Created ${clientAssignments.length} client assignments`);

    const instantiatedTrimesters: InstantiatedYear["trimesters"] = [];

    for (const templateTrimester of templateTrimestersList) {
      const [trimester] = await db
        .insert(universityTrimesters)
        .values({
          yearId: year.id,
          title: templateTrimester.title,
          description: templateTrimester.description,
          sortOrder: templateTrimester.sortOrder,
        })
        .returning();

      console.log(`✅ [AI-UNIVERSITY] Created trimester: ${trimester.title}`);

      const templateModulesList = await db
        .select()
        .from(templateModules)
        .where(eq(templateModules.templateTrimesterId, templateTrimester.id))
        .orderBy(asc(templateModules.sortOrder));

      const instantiatedModules: InstantiatedYear["trimesters"][0]["modules"] = [];

      for (const templateModule of templateModulesList) {
        const [module] = await db
          .insert(universityModules)
          .values({
            trimesterId: trimester.id,
            title: templateModule.title,
            description: templateModule.description,
            sortOrder: templateModule.sortOrder,
          })
          .returning();

        console.log(`✅ [AI-UNIVERSITY] Created module: ${module.title}`);

        const templateLessonsList = await db
          .select()
          .from(templateLessons)
          .where(eq(templateLessons.templateModuleId, templateModule.id))
          .orderBy(asc(templateLessons.sortOrder));

        const instantiatedLessons: InstantiatedYear["trimesters"][0]["modules"][0]["lessons"] = [];

        for (const templateLesson of templateLessonsList) {
          const [lesson] = await db
            .insert(universityLessons)
            .values({
              moduleId: module.id,
              title: templateLesson.title,
              description: templateLesson.description,
              resourceUrl: templateLesson.resourceUrl,
              libraryDocumentId: templateLesson.libraryDocumentId,
              exerciseId: templateLesson.exerciseId,
              sortOrder: templateLesson.sortOrder,
            })
            .returning();

          instantiatedLessons.push({
            id: lesson.id,
            title: lesson.title,
          });
        }

        console.log(`✅ [AI-UNIVERSITY] Created ${instantiatedLessons.length} lessons for module "${module.title}"`);

        instantiatedModules.push({
          id: module.id,
          title: module.title,
          lessons: instantiatedLessons,
        });
      }

      instantiatedTrimesters.push({
        id: trimester.id,
        title: trimester.title,
        modules: instantiatedModules,
      });
    }

    const instantiatedYear: InstantiatedYear = {
      yearId: year.id,
      clientAssignments,
      trimesters: instantiatedTrimesters,
    };

    const totalModules = instantiatedTrimesters.reduce((acc, t) => acc + t.modules.length, 0);
    const totalLessons = instantiatedTrimesters.reduce(
      (acc, t) => acc + t.modules.reduce((macc, m) => macc + m.lessons.length, 0),
      0
    );

    console.log(`🎉 [AI-UNIVERSITY] Successfully instantiated year with ${totalModules} modules and ${totalLessons} lessons for ${clientIds.length} clients`);

    return { success: true, instantiatedYear };
  } catch (error: any) {
    console.error(`❌ [AI-UNIVERSITY] Error:`, error.message || error);
    return { success: false, error: error.message || "Errore nell'istanziazione del percorso" };
  }
}
