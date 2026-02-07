import { db } from "../db";
import { sql } from "drizzle-orm";
import { GeminiClient } from "../ai/provider-factory";

export interface TaskConversationMessage {
  role: 'user' | 'assistant';
  transcript: string;
  timestamp: string;
}

export interface VoiceTaskSupervisorState {
  stage: 'nessun_intento' | 'raccolta_dati' | 'dati_completi' | 'conferma_richiesta' | 'confermato' | 'completato' | 'errore';
  taskInProgress: boolean;
  currentIntent: 'create_task' | 'modify_task' | 'cancel_task' | 'list_tasks' | 'none';
  extractedTasks: Array<{
    description: string | null;
    date: string | null;
    time: string | null;
    recurrenceType: 'once' | 'daily' | 'weekly' | null;
    recurrenceDays: number[] | null;
    recurrenceEndDate: string | null;
    originalExpression: string | null;
    aiCallInstruction: string | null;
  }>;
  modifyTarget: {
    searchBy: 'date' | 'description' | 'time' | null;
    originalDate: string | null;
    originalTime: string | null;
    originalDescription: string | null;
    newDate: string | null;
    newTime: string | null;
    newDescription: string | null;
    targetTaskId: string | null;
  };
  listFilter: {
    date: string | null;
    rangeStart: string | null;
    rangeEnd: string | null;
  } | null;
  confirmed: boolean;
  completedMessageBoundary: number;
  metadata: {
    turnsInCurrentState: number;
    totalTurns: number;
    lastAnalyzedMessageIndex: number;
    taskAttempts: number;
    createdTaskIds: string[];
    errorMessage: string | null;
  };
}

export interface TaskSupervisorResult {
  action: 'none' | 'confirm_request' | 'tasks_created' | 'task_modified' | 'task_cancelled' | 'tasks_listed' | 'task_failed';
  createdTaskIds?: string[];
  modifiedTaskId?: string;
  cancelledTaskId?: string;
  taskList?: string;
  errorMessage?: string;
  notifyMessage?: string;
  conflictWarning?: string;
}

interface LLMTaskAnalysisResult {
  intent: 'create_task' | 'modify_task' | 'cancel_task' | 'list_tasks' | 'none';
  tasks: Array<{
    description: string;
    date: string | null;
    time: string | null;
    recurrence_type: 'once' | 'daily' | 'weekly' | null;
    recurrence_days: number[] | null;
    recurrence_end_date: string | null;
    original_expression: string;
    ai_call_instruction: string | null;
  }>;
  modify_target: {
    search_by: 'date' | 'description' | 'time';
    original_date: string | null;
    original_time: string | null;
    original_description: string | null;
    new_date: string | null;
    new_time: string | null;
    new_description: string | null;
  } | null;
  list_filter: {
    date: string | null;
    range_start: string | null;
    range_end: string | null;
  } | null;
  confirmed: boolean;
  reasoning: string;
}

export class VoiceTaskSupervisor {
  private state: VoiceTaskSupervisorState;
  private consultantId: string;
  private voiceCallId: string;
  private contactPhone: string;
  private contactName: string | null;
  private static readonly MODEL = "gemini-2.5-flash-lite";
  private static readonly TIMEOUT_MS = 12000;
  private static readonly MAX_RECENT_MESSAGES = 12;

  constructor(params: {
    consultantId: string;
    voiceCallId: string;
    contactPhone: string;
    contactName: string | null;
  }) {
    this.consultantId = params.consultantId;
    this.voiceCallId = params.voiceCallId;
    this.contactPhone = params.contactPhone;
    this.contactName = params.contactName;

    this.state = {
      stage: 'nessun_intento',
      taskInProgress: false,
      currentIntent: 'none',
      extractedTasks: [],
      modifyTarget: {
        searchBy: null,
        originalDate: null,
        originalTime: null,
        originalDescription: null,
        newDate: null,
        newTime: null,
        newDescription: null,
        targetTaskId: null,
      },
      listFilter: null,
      confirmed: false,
      completedMessageBoundary: -1,
      metadata: {
        turnsInCurrentState: 0,
        totalTurns: 0,
        lastAnalyzedMessageIndex: -1,
        taskAttempts: 0,
        createdTaskIds: [],
        errorMessage: null,
      },
    };
  }

  async analyzeTranscript(messages: TaskConversationMessage[], aiClient: GeminiClient): Promise<TaskSupervisorResult> {
    if (this.state.taskInProgress) {
      console.log(`🔒 [VOICE-TASK-SUPERVISOR] Mutex skip - task operation in progress for call ${this.voiceCallId}`);
      return { action: 'none' };
    }

    if (this.state.stage === 'completato') {
      this.state.completedMessageBoundary = messages.length - 1;
      this.state.stage = 'nessun_intento';
      this.state.currentIntent = 'none';
      this.state.extractedTasks = [];
      this.state.modifyTarget = {
        searchBy: null,
        originalDate: null,
        originalTime: null,
        originalDescription: null,
        newDate: null,
        newTime: null,
        newDescription: null,
        targetTaskId: null,
      };
      this.state.listFilter = null;
      this.state.confirmed = false;
      this.state.metadata.turnsInCurrentState = 0;
      console.log(`📋 [VOICE-TASK-SUPERVISOR] Task completed - boundary set at message ${this.state.completedMessageBoundary}, future analysis will only consider new messages`);
    }

    if (messages.length - 1 <= this.state.metadata.lastAnalyzedMessageIndex) {
      return { action: 'none' };
    }

    const messagesAfterBoundary = this.state.completedMessageBoundary >= 0
      ? messages.slice(this.state.completedMessageBoundary + 1)
      : messages;
    const recentMessages = messagesAfterBoundary.slice(-VoiceTaskSupervisor.MAX_RECENT_MESSAGES);

    if (recentMessages.length === 0) {
      return { action: 'none' };
    }

    this.state.metadata.totalTurns++;
    this.state.metadata.turnsInCurrentState++;

    const dataBefore = {
      stage: this.state.stage,
      currentIntent: this.state.currentIntent,
      extractedTasks: [...this.state.extractedTasks],
      confirmed: this.state.confirmed,
    };

    const existingTasksText = await this.fetchExistingTasks();
    const prompt = this.buildAnalysisPrompt(recentMessages, existingTasksText);

    let analysisResult: LLMTaskAnalysisResult;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM analysis timeout')), VoiceTaskSupervisor.TIMEOUT_MS)
      );

      const llmPromise = aiClient.generateContent({
        model: VoiceTaskSupervisor.MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 2000 },
      });

      const response = await Promise.race([llmPromise, timeoutPromise]);

      let text = '';
      try {
        text = response.response.text();
      } catch {
        const candidates = (response as any).response?.candidates;
        if (candidates?.[0]?.content?.parts?.[0]?.text) {
          text = candidates[0].content.parts[0].text;
        }
      }

      if (!text) {
        console.warn(`⚠️ [VOICE-TASK-SUPERVISOR] Empty LLM response for call ${this.voiceCallId}`);
        return { action: 'none' };
      }

      let jsonStr = text.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      analysisResult = JSON.parse(jsonStr);
    } catch (error: any) {
      console.error(`❌ [VOICE-TASK-SUPERVISOR] LLM analysis failed for call ${this.voiceCallId}: ${error.message}`);
      return { action: 'none' };
    }

    this.state.currentIntent = analysisResult.intent;

    if (analysisResult.tasks && analysisResult.tasks.length > 0) {
      this.state.extractedTasks = analysisResult.tasks.map(t => ({
        description: t.description,
        date: t.date,
        time: t.time,
        recurrenceType: t.recurrence_type,
        recurrenceDays: t.recurrence_days,
        recurrenceEndDate: t.recurrence_end_date,
        originalExpression: t.original_expression,
        aiCallInstruction: t.ai_call_instruction || null,
      }));
    }

    if (analysisResult.modify_target) {
      this.state.modifyTarget = {
        searchBy: analysisResult.modify_target.search_by,
        originalDate: analysisResult.modify_target.original_date,
        originalTime: analysisResult.modify_target.original_time,
        originalDescription: analysisResult.modify_target.original_description,
        newDate: analysisResult.modify_target.new_date,
        newTime: analysisResult.modify_target.new_time,
        newDescription: analysisResult.modify_target.new_description || null,
        targetTaskId: null,
      };
    }

    if (analysisResult.list_filter) {
      this.state.listFilter = {
        date: analysisResult.list_filter.date,
        rangeStart: analysisResult.list_filter.range_start,
        rangeEnd: analysisResult.list_filter.range_end,
      };
    }

    this.state.confirmed = analysisResult.confirmed;

    const newStage = this.computeStage(analysisResult);
    if (newStage !== this.state.stage) {
      this.state.metadata.turnsInCurrentState = 0;
    }
    this.state.stage = newStage;

    this.state.metadata.lastAnalyzedMessageIndex = messages.length - 1;

    this.logAudit({
      stageBefore: dataBefore.stage,
      stageAfter: this.state.stage,
      intentBefore: dataBefore.currentIntent,
      intentAfter: this.state.currentIntent,
      confirmedBefore: dataBefore.confirmed,
      confirmedAfter: this.state.confirmed,
      tasksCount: this.state.extractedTasks.length,
      reasoning: analysisResult.reasoning,
      turn: this.state.metadata.totalTurns,
    });

    if (this.state.stage === 'confermato') {
      this.state.taskInProgress = true;
      return await this.executeTaskOperation();
    }

    if (this.state.currentIntent === 'list_tasks' && this.state.stage === 'raccolta_dati') {
      return await this.executeListTasks();
    }

    if (this.state.stage === 'dati_completi') {
      this.state.stage = 'conferma_richiesta';
      const confirmMsg = this.buildConfirmationRequest();
      console.log(`📋 [VOICE-TASK-SUPERVISOR] Confirmation request injected → stage: conferma_richiesta`);
      return {
        action: 'confirm_request',
        notifyMessage: confirmMsg,
      };
    }

    return { action: 'none' };
  }

  private computeStage(analysis: LLMTaskAnalysisResult): VoiceTaskSupervisorState['stage'] {
    if (analysis.intent === 'none') {
      return 'nessun_intento';
    }

    if (this.state.stage === 'conferma_richiesta') {
      if (analysis.confirmed) {
        if (analysis.intent === 'create_task') {
          const allComplete = analysis.tasks.every(t => t.description && t.date && t.time);
          if (allComplete && analysis.tasks.length > 0) {
            return 'confermato';
          }
        }
        if (analysis.intent === 'modify_task' && analysis.modify_target) {
          return 'confermato';
        }
        if (analysis.intent === 'cancel_task' && analysis.modify_target) {
          return 'confermato';
        }
      }

      if (analysis.intent !== this.state.currentIntent || analysis.intent === 'none') {
        return 'nessun_intento';
      }

      return 'conferma_richiesta';
    }

    if (analysis.intent === 'list_tasks') {
      return 'raccolta_dati';
    }

    if (analysis.intent === 'create_task') {
      const allComplete = analysis.tasks.every(t => t.description && t.date && t.time);
      if (allComplete && analysis.tasks.length > 0) {
        return 'dati_completi';
      }
      return 'raccolta_dati';
    }

    if (analysis.intent === 'modify_task' || analysis.intent === 'cancel_task') {
      if (analysis.modify_target && (analysis.modify_target.original_date || analysis.modify_target.original_description || analysis.modify_target.original_time)) {
        return 'dati_completi';
      }
      return 'raccolta_dati';
    }

    return 'raccolta_dati';
  }

  private buildConfirmationRequest(): string {
    const intent = this.state.currentIntent;

    if (intent === 'create_task' && this.state.extractedTasks.length > 0) {
      const taskSummaries = this.state.extractedTasks
        .filter(t => t.description && t.date && t.time)
        .map(t => {
          const recurrenceText = t.recurrenceType === 'daily' ? ' (ogni giorno)' : t.recurrenceType === 'weekly' ? ' (settimanale)' : '';
          return `"${t.description}" il ${t.date} alle ${t.time}${recurrenceText}`;
        })
        .join(', ');
      return `[CONFIRM_TASK] Chiedi conferma esplicita al chiamante prima di procedere. Riepilogo: vuole impostare un promemoria per ${taskSummaries}. Chiedi: "Confermi che vuoi che ti imposti questo promemoria?" e attendi la risposta.`;
    }

    if (intent === 'modify_task') {
      const { originalDescription, originalDate, originalTime, newDate, newTime, newDescription } = this.state.modifyTarget;
      const origRef = originalDescription || `del ${originalDate} alle ${originalTime}`;
      const changes: string[] = [];
      if (newDate) changes.push(`data: ${newDate}`);
      if (newTime) changes.push(`ora: ${newTime}`);
      if (newDescription) changes.push(`descrizione: "${newDescription}"`);
      return `[CONFIRM_TASK] Chiedi conferma esplicita al chiamante. Vuole modificare il promemoria ${origRef} → ${changes.join(', ')}. Chiedi: "Confermi la modifica?" e attendi la risposta.`;
    }

    if (intent === 'cancel_task') {
      const { originalDescription, originalDate, originalTime } = this.state.modifyTarget;
      const origRef = originalDescription || `del ${originalDate} alle ${originalTime}`;
      return `[CONFIRM_TASK] Chiedi conferma esplicita al chiamante. Vuole cancellare il promemoria ${origRef}. Chiedi: "Confermi la cancellazione?" e attendi la risposta.`;
    }

    return `[CONFIRM_TASK] Chiedi conferma esplicita al chiamante prima di procedere con l'operazione sul promemoria.`;
  }

  private async executeTaskOperation(): Promise<TaskSupervisorResult> {
    try {
      switch (this.state.currentIntent) {
        case 'create_task':
          return await this.executeCreateTasks();
        case 'modify_task':
          return await this.executeModifyTask();
        case 'cancel_task':
          return await this.executeCancelTask();
        default:
          this.state.taskInProgress = false;
          return { action: 'none' };
      }
    } catch (error: any) {
      console.error(`❌ [VOICE-TASK-SUPERVISOR] Task operation failed for call ${this.voiceCallId}: ${error.message}`);
      this.state.taskInProgress = false;
      this.state.metadata.taskAttempts++;
      this.state.stage = 'errore';
      this.state.metadata.errorMessage = error.message;
      return {
        action: 'task_failed',
        errorMessage: error.message,
      };
    }
  }

  private async executeCreateTasks(): Promise<TaskSupervisorResult> {
    const createdIds: string[] = [];
    const conflictWarnings: string[] = [];

    for (const task of this.state.extractedTasks) {
      if (!task.description || !task.date || !task.time) continue;

      const scheduledAt = `${task.date}T${task.time}:00`;

      const scheduledAtTz = `${scheduledAt} Europe/Rome`;

      const conflicts = await db.execute(sql`
        SELECT id, contact_name, ai_instruction, scheduled_at
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${this.consultantId} AND contact_phone = ${this.contactPhone}
        AND scheduled_at BETWEEN (${scheduledAtTz}::timestamptz - interval '30 minutes') AND (${scheduledAtTz}::timestamptz + interval '30 minutes')
        AND status IN ('scheduled', 'retry_pending')
      `);

      if (conflicts.rows.length > 0) {
        const existing = conflicts.rows[0] as any;
        conflictWarnings.push(`Conflitto: esiste già "${existing.ai_instruction}" alle ${new Date(existing.scheduled_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`);
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const isRecurring = task.recurrenceType === 'daily' || task.recurrenceType === 'weekly';
      const taskType = isRecurring ? 'follow_up' : 'single_call';
      const maxAttempts = isRecurring ? 3 : 1;
      const aiInstruction = task.aiCallInstruction && task.aiCallInstruction.length > 20
        ? task.aiCallInstruction
        : `Promemoria: ${task.description}${this.contactName ? `. Stai richiamando ${this.contactName} come da sua richiesta.` : ''}`;

      console.log(`📝 [VOICE-TASK-SUPERVISOR] AI instruction for task ${taskId}: ${aiInstruction.substring(0, 150)}...`);

      await db.execute(sql`
        INSERT INTO ai_scheduled_tasks (
          id, consultant_id, contact_name, contact_phone, task_type,
          ai_instruction, scheduled_at, timezone, recurrence_type,
          recurrence_days, recurrence_end_date, max_attempts,
          retry_delay_minutes, status, voice_direction
        ) VALUES (
          ${taskId}, ${this.consultantId}, ${this.contactName}, ${this.contactPhone}, ${taskType},
          ${aiInstruction}, ${scheduledAtTz}::timestamptz, 'Europe/Rome', ${task.recurrenceType || 'once'},
          ${task.recurrenceDays && task.recurrenceDays.length > 0 ? `{${task.recurrenceDays.join(',')}}` : null}::integer[], ${task.recurrenceEndDate},
          ${maxAttempts}, 15, 'scheduled', 'outbound'
        )
      `);

      createdIds.push(taskId);
    }

    this.state.taskInProgress = false;
    this.state.stage = 'completato';
    this.state.metadata.createdTaskIds.push(...createdIds);

    const taskDescriptions = this.state.extractedTasks
      .filter(t => t.description && t.date && t.time)
      .map(t => `"${t.description}" il ${t.date} alle ${t.time}`)
      .join(', ');

    const notifyMessage = `[TASK_CREATED] ${createdIds.length > 1 ? 'I promemoria sono stati creati con successo' : 'Il promemoria è stato creato con successo'}: ${taskDescriptions}. Conferma al chiamante che è tutto a posto e che verrà ricontattato come concordato.`;

    return {
      action: 'tasks_created',
      createdTaskIds: createdIds,
      notifyMessage,
      conflictWarning: conflictWarnings.length > 0 ? conflictWarnings.join('; ') : undefined,
    };
  }

  private async executeModifyTask(): Promise<TaskSupervisorResult> {
    const { originalDate, originalTime, originalDescription, newDate, newTime, newDescription, searchBy } = this.state.modifyTarget;

    let whereConditions = [
      sql`consultant_id = ${this.consultantId}`,
      sql`contact_phone = ${this.contactPhone}`,
      sql`status IN ('scheduled', 'retry_pending', 'paused')`,
    ];

    if (searchBy === 'date' && originalDate) {
      whereConditions.push(sql`(scheduled_at AT TIME ZONE 'Europe/Rome')::date = ${originalDate}::date`);
    }
    if (searchBy === 'time' && originalTime) {
      const timeFilter = `${originalTime}:00`;
      whereConditions.push(sql`(scheduled_at AT TIME ZONE 'Europe/Rome')::time = ${timeFilter}::time`);
    }
    if (searchBy === 'description' && originalDescription) {
      whereConditions.push(sql`ai_instruction ILIKE ${'%' + originalDescription + '%'}`);
    }

    const candidates = await db.execute(sql`
      SELECT id, ai_instruction, scheduled_at, recurrence_type, status
      FROM ai_scheduled_tasks
      WHERE ${sql.join(whereConditions, sql` AND `)}
      ORDER BY scheduled_at ASC
      LIMIT 5
    `);

    if (candidates.rows.length === 0) {
      this.state.taskInProgress = false;
      this.state.stage = 'errore';
      this.state.metadata.errorMessage = 'Nessun promemoria trovato con i criteri specificati';
      return {
        action: 'task_failed',
        errorMessage: 'Nessun promemoria trovato con i criteri specificati',
        notifyMessage: '[TASK_NOT_FOUND] Non ho trovato nessun promemoria corrispondente. Chiedi al chiamante di specificare meglio.',
      };
    }

    const targetTask = candidates.rows[0] as any;
    this.state.modifyTarget.targetTaskId = targetTask.id;

    if (newDate || newTime) {
      const existingDate = new Date(targetTask.scheduled_at);
      const finalDate = newDate || existingDate.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
      const finalTime = newTime || existingDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' });
      const newScheduledAt = `${finalDate}T${finalTime}:00 Europe/Rome`;

      await db.execute(sql`
        UPDATE ai_scheduled_tasks
        SET scheduled_at = ${newScheduledAt}::timestamptz, updated_at = NOW()
        WHERE id = ${targetTask.id} AND consultant_id = ${this.consultantId}
      `);
    }

    if (newDescription) {
      await db.execute(sql`
        UPDATE ai_scheduled_tasks
        SET ai_instruction = ${newDescription}, updated_at = NOW()
        WHERE id = ${targetTask.id} AND consultant_id = ${this.consultantId}
      `);
    }

    this.state.taskInProgress = false;
    this.state.stage = 'completato';

    const modifiedDesc = newDescription || targetTask.ai_instruction;
    const notifyMessage = `[TASK_MODIFIED] Promemoria "${modifiedDesc}" modificato con successo. Comunica la conferma al chiamante.`;

    return {
      action: 'task_modified',
      modifiedTaskId: targetTask.id,
      notifyMessage,
    };
  }

  private async executeCancelTask(): Promise<TaskSupervisorResult> {
    const { originalDate, originalTime, originalDescription, searchBy } = this.state.modifyTarget;

    let whereConditions = [
      sql`consultant_id = ${this.consultantId}`,
      sql`contact_phone = ${this.contactPhone}`,
      sql`status IN ('scheduled', 'retry_pending', 'paused')`,
    ];

    if (searchBy === 'date' && originalDate) {
      whereConditions.push(sql`scheduled_at::date = ${originalDate}::date`);
    }
    if (searchBy === 'time' && originalTime) {
      const timeFilter = `${originalTime}:00`;
      whereConditions.push(sql`scheduled_at::time = ${timeFilter}::time`);
    }
    if (searchBy === 'description' && originalDescription) {
      whereConditions.push(sql`ai_instruction ILIKE ${'%' + originalDescription + '%'}`);
    }

    const candidates = await db.execute(sql`
      SELECT id, ai_instruction, scheduled_at
      FROM ai_scheduled_tasks
      WHERE ${sql.join(whereConditions, sql` AND `)}
      ORDER BY scheduled_at ASC
      LIMIT 5
    `);

    if (candidates.rows.length === 0) {
      this.state.taskInProgress = false;
      this.state.stage = 'errore';
      this.state.metadata.errorMessage = 'Nessun promemoria trovato da cancellare';
      return {
        action: 'task_failed',
        errorMessage: 'Nessun promemoria trovato da cancellare',
        notifyMessage: '[TASK_NOT_FOUND] Non ho trovato nessun promemoria da cancellare. Chiedi al chiamante di specificare meglio.',
      };
    }

    const targetTask = candidates.rows[0] as any;

    await db.execute(sql`
      UPDATE ai_scheduled_tasks SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${targetTask.id} AND consultant_id = ${this.consultantId}
    `);

    this.state.taskInProgress = false;
    this.state.stage = 'completato';

    const notifyMessage = `[TASK_CANCELLED] Promemoria "${targetTask.ai_instruction}" cancellato con successo. Comunica la conferma al chiamante.`;

    return {
      action: 'task_cancelled',
      cancelledTaskId: targetTask.id,
      notifyMessage,
    };
  }

  private async executeListTasks(): Promise<TaskSupervisorResult> {
    const tasks = await db.execute(sql`
      SELECT id, ai_instruction, scheduled_at, recurrence_type, status
      FROM ai_scheduled_tasks
      WHERE consultant_id = ${this.consultantId} AND contact_phone = ${this.contactPhone}
      AND status IN ('scheduled', 'retry_pending', 'paused')
      AND scheduled_at >= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 20
    `);

    if (tasks.rows.length === 0) {
      return {
        action: 'tasks_listed',
        taskList: 'Nessun promemoria attivo.',
        notifyMessage: '[TASK_LIST] Non ci sono promemoria attivi per questo numero. Comunica al chiamante.',
      };
    }

    const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const formattedList = (tasks.rows as any[]).map((t, i) => {
      const dt = new Date(t.scheduled_at);
      const dayName = dayNames[dt.getDay()];
      const dateStr = dt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = dt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
      const recurrence = t.recurrence_type === 'daily' ? ' (giornaliero)' : t.recurrence_type === 'weekly' ? ' (settimanale)' : '';
      return `${i + 1}. ${t.ai_instruction} - ${dayName} ${dateStr} alle ${timeStr}${recurrence}`;
    }).join('\n');

    return {
      action: 'tasks_listed',
      taskList: formattedList,
      notifyMessage: `[TASK_LIST] Ecco i promemoria attivi:\n${formattedList}\n\nLeggi la lista al chiamante in modo naturale.`,
    };
  }

  private async fetchExistingTasks(): Promise<string> {
    try {
      const tasks = await db.execute(sql`
        SELECT id, ai_instruction, scheduled_at, recurrence_type, status, contact_name
        FROM ai_scheduled_tasks
        WHERE consultant_id = ${this.consultantId} AND contact_phone = ${this.contactPhone}
        AND status IN ('scheduled', 'retry_pending', 'paused')
        AND (scheduled_at >= NOW() OR recurrence_type IN ('daily', 'weekly'))
        ORDER BY scheduled_at ASC
        LIMIT 20
      `);

      if (tasks.rows.length === 0) {
        return 'Nessun task attivo.';
      }

      const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

      return (tasks.rows as any[]).map(t => {
        const dt = new Date(t.scheduled_at);
        const romeDt = new Date(dt.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
        const dayName = dayNames[romeDt.getDay()];
        const dateStr = romeDt.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        const timeStr = romeDt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });

        const instruction = t.ai_instruction || '';
        let shortDesc = instruction;
        const periodIdx = instruction.indexOf('.');
        if (periodIdx > 0 && periodIdx <= 80) {
          shortDesc = instruction.substring(0, periodIdx);
        } else if (instruction.length > 80) {
          shortDesc = instruction.substring(0, 80) + '...';
        }

        const recurrence = t.recurrence_type === 'daily' ? ' (giornaliero)' : t.recurrence_type === 'weekly' ? ' (settimanale)' : '';
        return `- [ID: ${t.id}] 📅 ${dayName} ${dateStr} alle ${timeStr} - "${shortDesc}"${recurrence}`;
      }).join('\n');
    } catch (error: any) {
      console.error(`❌ [VOICE-TASK-SUPERVISOR] fetchExistingTasks failed: ${error.message}`);
      return 'Nessun task attivo.';
    }
  }

  private buildAnalysisPrompt(messages: TaskConversationMessage[], existingTasksText?: string): string {
    const { stage, currentIntent, extractedTasks, modifyTarget, confirmed } = this.state;

    const formattedMessages = messages
      .map(m => `${m.role === 'user' ? 'UTENTE' : 'ASSISTENTE'}: ${m.transcript}`)
      .join('\n');

    const now = new Date();
    const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const todayFormatted = now.toISOString().slice(0, 10);
    const todayDayName = dayNames[now.getDay()];
    const currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' });

    const extractedTasksText = extractedTasks.length > 0
      ? extractedTasks.map((t, i) => `  Task ${i + 1}: desc="${t.description}", date=${t.date}, time=${t.time}, recurrence=${t.recurrenceType}, original="${t.originalExpression}"`).join('\n')
      : '  Nessuno';

    const modifyTargetText = modifyTarget.searchBy
      ? `searchBy=${modifyTarget.searchBy}, origDate=${modifyTarget.originalDate}, origTime=${modifyTarget.originalTime}, origDesc=${modifyTarget.originalDescription}, newDate=${modifyTarget.newDate}, newTime=${modifyTarget.newTime}`
      : 'Nessuno';

    const boundaryWarning = this.state.completedMessageBoundary >= 0
      ? `\n⚠️ CONTESTO IMPORTANTE: Un task/promemoria è stato appena completato con successo. La trascrizione qui sotto contiene SOLO i messaggi SUCCESSIVI a quell'operazione. IGNORA completamente qualsiasi riferimento a task precedenti già gestiti. Concentrati ESCLUSIVAMENTE sulla NUOVA richiesta del chiamante in questa porzione di conversazione.\n`
      : '';

    return `Sei un analizzatore di trascrizioni vocali per un sistema di gestione promemoria e task.
${boundaryWarning}
DATA ODIERNA: ${todayFormatted} (${todayDayName})
ORA ATTUALE: ${currentTime}

REGOLE DI PARSING TEMPORALE:
- "domani" = il giorno dopo ${todayFormatted}
- "dopodomani" = due giorni dopo ${todayFormatted}
- "tra X minuti" = aggiungi esattamente X minuti all'ORA ATTUALE. Esempio: se ORA ATTUALE è ${currentTime} e l'utente dice "tra 5 minuti", calcola ${currentTime} + 5 minuti
- "tra X ore" / "tra 2 ore" = aggiungi esattamente X ore all'ORA ATTUALE
- "dopo pranzo" = 14:00
- "la prossima settimana" = prossimo lunedì dopo oggi
- "fra X giorni" = ${todayFormatted} + X giorni
- "ogni lunedì e mercoledì" = recurrence_type="weekly", recurrence_days=[1,3]
- "per le prossime 2 settimane" = calcola recurrence_end_date = oggi + 14 giorni
- "stasera" = oggi, 20:00
- "stamattina" = oggi, 09:00
- "nel pomeriggio" = oggi, 15:00
- IMPORTANTE: per QUALSIASI espressione temporale relativa ("tra X minuti", "tra X ore"), DEVI calcolare l'ora esatta sommando all'ORA ATTUALE. NON usare mai valori predefiniti.
- Se non specificata l'ora E non è un'espressione relativa, usa 09:00 come default

STATO ATTUALE:
- Fase: ${stage}
- Intent corrente: ${currentIntent}
- Confermato: ${confirmed}
- Task estratti:
${extractedTasksText}
- Target modifica: ${modifyTargetText}

TASK ESISTENTI PER QUESTO UTENTE:
${existingTasksText || 'Nessun task attivo.'}

IMPORTANTE: Per "modify_task" e "cancel_task", usa le informazioni dei task esistenti per identificare correttamente quale task l'utente vuole modificare o cancellare. Cerca corrispondenze per descrizione, data o ora.

TRASCRIZIONE RECENTE:
${formattedMessages}

ISTRUZIONI:
Analizza la conversazione e rispondi SOLO con JSON valido nel seguente formato:
{
  "intent": "create_task|modify_task|cancel_task|list_tasks|none",
  "tasks": [
    {
      "description": "cosa ricordare (breve)",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "recurrence_type": "once|daily|weekly" o null,
      "recurrence_days": [1,3,5] o null,
      "recurrence_end_date": "YYYY-MM-DD" o null,
      "original_expression": "espressione originale dell'utente",
      "ai_call_instruction": "Istruzione dettagliata per l'AI che effettuerà la chiamata. Deve includere: 1) CHI stai chiamando (nome se disponibile), 2) PERCHÉ stai chiamando (il contesto dalla conversazione), 3) COSA dire specificamente, 4) eventuali dettagli rilevanti emersi dalla conversazione. Esempio: 'Stai richiamando Mario Rossi come da sua richiesta durante la chiamata precedente. Voleva essere ricontattato per discutere delle opzioni di investimento per il fondo pensione. Ricordagli le 3 opzioni discusse e chiedi se ha preso una decisione.'"
    }
  ],
  "modify_target": {
    "search_by": "date|description|time",
    "original_date": "YYYY-MM-DD" o null,
    "original_time": "HH:MM" o null,
    "original_description": "testo" o null,
    "new_date": "YYYY-MM-DD" o null,
    "new_time": "HH:MM" o null,
    "new_description": "nuova descrizione" o null
  } o null,
  "list_filter": {
    "date": "YYYY-MM-DD" o null,
    "range_start": "YYYY-MM-DD" o null,
    "range_end": "YYYY-MM-DD" o null
  } o null,
  "confirmed": true/false,
  "reasoning": "breve spiegazione in italiano"
}

REGOLE CRITICHE:
1. "confirmed" = true SOLO SE vengono soddisfatte TUTTE queste condizioni:
   a) L'ULTIMO messaggio con ruolo "UTENTE" (NON "ASSISTENTE") contiene una parola di conferma esplicita ("sì", "confermo", "va bene", "esatto", "ok", "certo", "perfetto")
   b) PRIMA di quel messaggio, l'ASSISTENTE ha riepilogato il promemoria chiedendo conferma
   c) Il messaggio dell'UTENTE NON è un messaggio di sistema (NON contiene [SYSTEM_INSTRUCTION], [TASK_CREATED], [TASK_MODIFIED], [TASK_CANCELLED], [BOOKING_CREATED])
2. "confirmed" DEVE essere false se:
   - L'ultimo messaggio è dell'ASSISTENTE (sta ancora aspettando risposta dell'utente)
   - L'utente ha appena chiesto di creare il promemoria ma l'assistente non ha ancora confermato i dettagli
   - Non ci sono parole di conferma esplicite nell'ultimo messaggio UTENTE
3. Se l'utente menziona più promemoria, crea un array di tasks (es: "ricordami X alle 9 e Y alle 15" = 2 tasks)
4. "intent" = "none" se la conversazione non riguarda promemoria, reminder, task, cose da ricordare
5. Per "modify_task": identifica il task da modificare tramite data, ora o descrizione e specifica i nuovi valori
6. Per "cancel_task": identifica il task da cancellare tramite data, ora o descrizione
7. Per "list_tasks": l'utente chiede "che promemoria ho?", "quali reminder ho?", "elenca i miei task"
8. Converti SEMPRE le espressioni temporali relative in date/ore concrete usando la data/ora corrente
9. Se manca la descrizione o la data/ora, NON impostare confirmed=true
10. "recurrence_type" = "once" per task singoli, "daily" per giornalieri, "weekly" per settimanali
11. Se l'utente dice "ogni lunedì e mercoledì", usa recurrence_type="weekly" e recurrence_days=[1,3]
12. IGNORA completamente qualsiasi messaggio che contiene tag di sistema come [SYSTEM_INSTRUCTION], [TASK_CREATED], [BOOKING_CREATED] - questi NON sono messaggi dell'utente
13. REGOLA CONFERMA GATED: Se la fase corrente è "conferma_richiesta", puoi impostare confirmed=true. Se la fase è "dati_completi", "raccolta_dati" o "nessun_intento", "confirmed" DEVE essere false perché la conferma esplicita non è ancora stata richiesta dal sistema.
14. Dopo un boundary (task appena completato), concentrati SOLO sulla nuova richiesta. Estrai i dati della NUOVA richiesta, non di task precedenti.`;
  }

  async getTaskPromptSection(): Promise<string> {
    const now = new Date();
    const dayNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const todayFormatted = now.toISOString().slice(0, 10);
    const todayDayName = dayNames[now.getDay()];
    const currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' });

    const existingTasksText = await this.fetchExistingTasks();

    return `## GESTIONE PROMEMORIA E TASK

Data odierna: ${todayFormatted} (${todayDayName})
Ora attuale: ${currentTime}

Se il chiamante chiede un promemoria, un reminder, o una cosa da ricordare:

PROCEDURA CREAZIONE:
1. Raccogli: cosa ricordare + quando (data e ora)
2. Gestisci espressioni temporali: "domani", "tra 2 ore", "dopo pranzo" (14:00), etc.
3. Ripeti per conferma: "Vuoi che ti ricordi [cosa] [quando]?"
4. Attendi conferma esplicita

PROCEDURA MODIFICA/CANCELLAZIONE:
- "sposta il promemoria di domani alle 18" → modifica
- "cancella il promemoria del dentista" → cancellazione
- Conferma sempre prima di eseguire

PROCEDURA LISTA:
- "che promemoria ho?" → elenca i task attivi

TASK ATTIVI DEL CHIAMANTE:
${existingTasksText}

Puoi riferire al chiamante i suoi task attivi se li chiede, e aiutarlo a modificarli o cancellarli.

⚠️ FLUSSO CONFERMA (OBBLIGATORIO):
1. Quando ricevi un messaggio [CONFIRM_TASK], devi chiedere conferma esplicita al chiamante ripetendo il riepilogo del promemoria
2. Attendi la risposta del chiamante ("sì", "confermo", etc.)
3. Dopo il "sì", rispondi SOLO con "Perfetto, sto impostando il promemoria..." e attendi
4. NON dire "fatto" o "creato" finché non ricevi un messaggio di sistema [TASK_CREATED] o [TASK_MODIFIED]
5. Quando ricevi [TASK_CREATED], conferma al chiamante con naturalezza: "Tutto fatto! Ti richiamerò come concordato."`;
  }

  private logAudit(params: {
    stageBefore: string;
    stageAfter: string;
    intentBefore: string;
    intentAfter: string;
    confirmedBefore: boolean;
    confirmedAfter: boolean;
    tasksCount: number;
    reasoning: string;
    turn: number;
  }): void {
    const stageChanged = params.stageBefore !== params.stageAfter;
    const stageIndicator = stageChanged ? '🔄' : '➡️';

    const deltas: string[] = [];
    if (params.stageBefore !== params.stageAfter) deltas.push(`stage: ${params.stageBefore} → ${params.stageAfter}`);
    if (params.intentBefore !== params.intentAfter) deltas.push(`intent: ${params.intentBefore} → ${params.intentAfter}`);
    if (params.confirmedBefore !== params.confirmedAfter) deltas.push(`confirmed: ${params.confirmedBefore} → ${params.confirmedAfter}`);

    console.log(`\n📋 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [VOICE-TASK-SUPERVISOR] AUDIT LOG - Call ${this.voiceCallId.slice(0, 8)}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Turn: ${params.turn} | ${stageIndicator} Stage: ${params.stageBefore} → ${params.stageAfter}`);
    console.log(`   Intent: ${params.intentAfter} | Tasks: ${params.tasksCount} | Confirmed: ${params.confirmedAfter}`);
    if (deltas.length > 0) {
      console.log(`   Deltas: ${deltas.join(' | ')}`);
    }
    console.log(`   Reasoning: ${params.reasoning}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  getState(): VoiceTaskSupervisorState {
    return { ...this.state };
  }
}
