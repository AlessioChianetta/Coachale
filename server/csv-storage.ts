import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from "crypto";
import {
  type User,
  type InsertUser,
  type Exercise,
  type InsertExercise,
  type ExerciseAssignment,
  type InsertExerciseAssignment,
  type ExerciseSubmission,
  type InsertExerciseSubmission,
  type Consultation,
  type InsertConsultation,
  type Goal,
  type InsertGoal,
  type ClientProgress,
  type InsertClientProgress,
  type ClientEngagementMetrics,
  type InsertClientEngagementMetrics,
  type ExercisePerformanceMetrics,
  type InsertExercisePerformanceMetrics,
  type ConsultantAnalytics,
  type InsertConsultantAnalytics,
  type ClientAnalyticsSummary,
  type InsertClientAnalyticsSummary,
  type ExerciseTemplate,
  type InsertExerciseTemplate
} from "@shared/schema";
import { type IStorage } from "./storage";

// Assuming MemStorage exists and has the activity logging and session management methods
// import { MemStorage } from './memStorage'; // This line would typically be present if MemStorage is in a separate file

// Placeholder for MemStorage if it's not imported or defined elsewhere
// In a real scenario, this would be properly imported or defined.
class MemStorage implements IStorage {
  // Placeholder methods, actual implementation would exist in MemStorage
  async createUserActivityLog(log: any): Promise<any> { console.log("MemStorage: createUserActivityLog called with", log); return log; }
  async getUserActivityLogs(userId?: string, startDate?: Date, endDate?: Date, activityType?: string): Promise<any[]> { console.log("MemStorage: getUserActivityLogs called"); return []; }
  async getUserActivityLogsByConsultant(consultantId: string, startDate?: Date, endDate?: Date): Promise<any[]> { console.log("MemStorage: getUserActivityLogsByConsultant called"); return []; }
  async createUserSession(session: any): Promise<any> { console.log("MemStorage: createUserSession called with", session); return session; }
  async getUserSession(sessionId: string): Promise<any> { console.log("MemStorage: getUserSession called with", sessionId); return undefined; }
  async updateUserSession(sessionId: string, updates: any): Promise<any> { console.log("MemStorage: updateUserSession called with", sessionId, updates); return undefined; }
  async getActiveUserSessions(consultantId?: string): Promise<any[]> { console.log("MemStorage: getActiveUserSessions called"); return []; }
  async endUserSession(sessionId: string): Promise<any> { console.log("MemStorage: endUserSession called with", sessionId); return undefined; }

  // Other IStorage methods would be implemented here as well
  async getUser(id: string): Promise<User | undefined> { return undefined; }
  async getUserByEmail(email: string): Promise<User | undefined> { return undefined; }
  async getUserByUsername(username: string): Promise<User | undefined> { return undefined; }
  async getUsersByRole(role: "client" | "consultant"): Promise<User[]> { return []; }
  async createUser(insertUser: InsertUser): Promise<User> { return {} as User; }
  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> { return undefined; }
  async getClientsByConsultant(consultantId: string): Promise<User[]> { return []; }
  async getExercise(id: string): Promise<Exercise | undefined> { return undefined; }
  async createExercise(insertExercise: InsertExercise, createdBy: string): Promise<Exercise> { return {} as Exercise; }
  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise | undefined> { return undefined; }
  async deleteExercise(id: string): Promise<boolean> { return false; }
  async getExercisesByConsultant(consultantId: string): Promise<Exercise[]> { return []; }
  async getGeneralExercises(): Promise<Exercise[]> { return []; }
  async createExerciseAssignment(insertAssignment: InsertExerciseAssignment): Promise<ExerciseAssignment> { return {} as ExerciseAssignment; }
  async getExerciseAssignment(id: string): Promise<ExerciseAssignment | undefined> { return undefined; }
  async getAssignmentsByClient(clientId: string): Promise<(ExerciseAssignment & { exercise: Exercise, consultant: User })[]> { return []; }
  async getAssignmentsByConsultant(consultantId: string): Promise<(ExerciseAssignment & { exercise: Exercise, client: User })[]> { return []; }
  async updateAssignmentStatus(id: string, status: "pending" | "in_progress" | "submitted" | "completed" | "rejected"): Promise<ExerciseAssignment | undefined> { return undefined; }
  async rejectAssignment(id: string, updates: { consultantFeedback: string; reviewedAt: Date; }, createdBy: string): Promise<ExerciseAssignment | undefined> { return undefined; }
  async reviewAssignment(id: string, updates: { score: number; consultantFeedback: string; status: string; reviewedAt: Date; completedAt: Date; }, createdBy: string): Promise<ExerciseAssignment | undefined> { return undefined; }
  async returnAssignmentToClient(id: string, updates: { consultantFeedback: string; status: string; reviewedAt: Date; }, createdBy: string): Promise<ExerciseAssignment | undefined> { return undefined; }
  async createExerciseSubmission(insertSubmission: InsertExerciseSubmission): Promise<ExerciseSubmission> { return {} as ExerciseSubmission; }
  async getSubmissionsByAssignment(assignmentId: string): Promise<ExerciseSubmission[]> { return []; }
  async getExerciseSubmissionByAssignment(assignmentId: string): Promise<ExerciseSubmission | undefined> { return undefined; }
  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> { return {} as Consultation; }
  async getConsultationsByClient(clientId: string): Promise<(Consultation & { consultant: User })[]> { return []; }
  async getConsultationsByConsultant(consultantId: string): Promise<(Consultation & { client: User })[]> { return []; }
  async updateConsultation(id: string, updates: Partial<Consultation>): Promise<Consultation | undefined> { return undefined; }
  async getConsultation(id: string): Promise<Consultation | undefined> { return undefined; }
  async deleteConsultation(id: string): Promise<boolean> { return false; }
  async createGoal(insertGoal: InsertGoal): Promise<Goal> { return {} as Goal; }
  async getGoalsByClient(clientId: string): Promise<Goal[]> { return []; }
  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined> { return undefined; }
  async createClientProgress(insertProgress: InsertClientProgress): Promise<ClientProgress> { return {} as ClientProgress; }
  async getClientProgress(clientId: string, date?: Date): Promise<ClientProgress[]> { return []; }
  async updateClientProgress(clientId: string, date: Date, updates: Partial<ClientProgress>): Promise<ClientProgress | undefined> { return undefined; }
  async createExerciseTemplate(template: InsertExerciseTemplate, createdBy: string): Promise<ExerciseTemplate> { return {} as ExerciseTemplate; }
  async getExerciseTemplate(id: string): Promise<ExerciseTemplate | undefined> { return undefined; }
  async getExerciseTemplatesByConsultant(consultantId: string): Promise<ExerciseTemplate[]> { return []; }
  async getPublicExerciseTemplates(): Promise<ExerciseTemplate[]> { return []; }
  async searchExerciseTemplates(filters: { category?: string; tags?: string[]; type?: "general" | "personalized"; createdBy?: string; isPublic?: boolean; }): Promise<ExerciseTemplate[]> { return []; }
  async updateExerciseTemplate(id: string, updates: Partial<ExerciseTemplate>): Promise<ExerciseTemplate | undefined> { return undefined; }
  async deleteExerciseTemplate(id: string): Promise<boolean> { return false; }
  async incrementTemplateUsage(id: string): Promise<ExerciseTemplate | undefined> { return undefined; }
  async copyTemplateToExercise(templateId: string, createdBy: string): Promise<Exercise> { return {} as Exercise; }
  async createClientEngagementMetrics(insertMetrics: InsertClientEngagementMetrics): Promise<ClientEngagementMetrics> { return {} as ClientEngagementMetrics; }
  async getClientEngagementMetrics(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<ClientEngagementMetrics[]> { return []; }
  async updateClientEngagementMetrics(id: string, updates: Partial<ClientEngagementMetrics>): Promise<ClientEngagementMetrics | undefined> { return undefined; }
  async createExercisePerformanceMetrics(insertMetrics: InsertExercisePerformanceMetrics): Promise<ExercisePerformanceMetrics> { return {} as ExercisePerformanceMetrics; }
  async getExercisePerformanceMetrics(exerciseId?: string, clientId?: string, assignmentId?: string): Promise<ExercisePerformanceMetrics[]> { return []; }
  async updateExercisePerformanceMetrics(id: string, updates: Partial<ExercisePerformanceMetrics>): Promise<ExercisePerformanceMetrics | undefined> { return undefined; }
  async createConsultantAnalytics(insertAnalytics: InsertConsultantAnalytics): Promise<ConsultantAnalytics> { return {} as ConsultantAnalytics; }
  async getConsultantAnalytics(consultantId: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ConsultantAnalytics[]> { return []; }
  async updateConsultantAnalytics(id: string, updates: Partial<ConsultantAnalytics>): Promise<ConsultantAnalytics | undefined> { return undefined; }
  async createClientAnalyticsSummary(insertSummary: InsertClientAnalyticsSummary): Promise<ClientAnalyticsSummary> { return {} as ClientAnalyticsSummary; }
  async getClientAnalyticsSummary(clientId?: string, consultantId?: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ClientAnalyticsSummary[]> { return []; }
  async updateClientAnalyticsSummary(id: string, updates: Partial<ClientAnalyticsSummary>): Promise<ClientAnalyticsSummary | undefined> { return undefined; }
  async calculateConsultantOverallStats(consultantId: string, startDate?: Date, endDate?: Date): Promise<{ totalClients: number; activeClients: number; totalExercises: number; completedExercises: number; completionRate: number; avgClientEngagement: number; totalConsultations: number; clientRetentionRate: number; }> { return { totalClients: 0, activeClients: 0, totalExercises: 0, completedExercises: 0, completionRate: 0, avgClientEngagement: 0, totalConsultations: 0, clientRetentionRate: 0 }; }
  async calculateClientPerformanceStats(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<{ totalExercisesAssigned: number; completedExercises: number; completionRate: number; avgCompletionTime: number; avgScore: number; avgSatisfactionRating: number; streakDays: number; engagementScore: number; }> { return { totalExercisesAssigned: 0, completedExercises: 0, completionRate: 0, avgCompletionTime: 0, avgScore: 0, avgSatisfactionRating: 0, streakDays: 0, engagementScore: 0 }; }
  async getExerciseCompletionTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{ date: Date; completed: number; assigned: number; completionRate: number; }[]> { return []; }
  async getClientEngagementTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{ date: Date; totalSessions: number; avgSessionDuration: number; totalLogins: number; activeClients: number; }[]> { return []; }
}


export class CSVStorage extends MemStorage implements IStorage { // Assuming it extends MemStorage based on the 'super' calls
  private dataDir = path.join(process.cwd(), 'data');

  constructor() {
    super(); // Call the constructor of the parent class
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(tableName: string): string {
    return path.join(this.dataDir, `${tableName}.csv`);
  }

  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private escapeCSVValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private objectToCSVRow(obj: any, headers: string[]): string {
    return headers.map(header => {
      let value = obj[header];

      // Handle special field types
      if (value instanceof Date) {
        value = value.toISOString();
      } else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        value = JSON.stringify(value);
      }

      return this.escapeCSVValue(value);
    }).join(',');
  }

  private csvRowToObject(row: string[], headers: string[]): any {
    const obj: any = {};

    headers.forEach((header, index) => {
      let value = row[index] || '';

      // Parse special field types
      if (header.includes('At') || header.includes('Date') || header === 'date') {
        obj[header] = value ? new Date(value) : null;
      } else if (header === 'attachments' || header === 'questions' || header === 'answers' || header === 'tags') {
        try {
          obj[header] = value ? JSON.parse(value) : [];
        } catch (e) {
          obj[header] = [];
        }
      } else if (header.includes('Count') || header.includes('Duration') || header.includes('Rating') || header.includes('Days') || header === 'score') {
        obj[header] = value ? parseInt(value) : null;
      } else {
        obj[header] = value || null;
      }
    });

    return obj;
  }

  private readCSV<T>(tableName: string, headers: string[]): T[] {
    const filePath = this.getFilePath(tableName);

    if (!fs.existsSync(filePath)) {
      // Create file with headers
      fs.writeFileSync(filePath, headers.join(',') + '\n');
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = this.parseCSVContent(content);

    if (rows.length <= 1) {
      return [];
    }

    return rows.slice(1).map(row => {
      return this.csvRowToObject(row, headers) as T;
    });
  }

  private parseCSVContent(content: string): string[][] {
    const rows: string[][] = [];
    const lines = content.trim().split('\n');

    if (lines.length === 0) return rows;

    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];

      if (char === '"') {
        if (inQuotes && content[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell);
        if (currentRow.length > 0 && currentRow.some(cell => cell.trim() !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }

      i++;
    }

    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell);
      if (currentRow.length > 0 && currentRow.some(cell => cell.trim() !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  private writeCSV<T>(tableName: string, data: T[], headers: string[]) {
    const filePath = this.getFilePath(tableName);

    const csvContent = [
      headers.join(','),
      ...data.map(item => this.objectToCSVRow(item, headers))
    ].join('\n');

    fs.writeFileSync(filePath, csvContent);
  }

  // Define headers for each table
  private getUserHeaders(): string[] {
    return ['id', 'username', 'email', 'password', 'firstName', 'lastName', 'role', 'avatar', 'consultantId', 'createdAt'];
  }

  private getExerciseHeaders(): string[] {
    return ['id', 'title', 'description', 'type', 'category', 'estimatedDuration', 'instructions', 'attachments', 'questions', 'workPlatform', 'createdBy', 'createdAt'];
  }

  private getExerciseAssignmentHeaders(): string[] {
    return ['id', 'exerciseId', 'clientId', 'consultantId', 'assignedAt', 'dueDate', 'status', 'completedAt', 'submittedAt', 'reviewedAt', 'score', 'consultantFeedback'];
  }

  private getExerciseSubmissionHeaders(): string[] {
    return ['id', 'assignmentId', 'answers', 'attachments', 'notes', 'submittedAt'];
  }

  private getConsultationHeaders(): string[] {
    return ['id', 'consultantId', 'clientId', 'scheduledAt', 'duration', 'notes', 'status', 'createdAt'];
  }

  private getGoalHeaders(): string[] {
    return ['id', 'clientId', 'title', 'description', 'targetValue', 'currentValue', 'unit', 'targetDate', 'status', 'createdAt'];
  }

  private getClientProgressHeaders(): string[] {
    return ['id', 'clientId', 'date', 'exercisesCompleted', 'totalExercises', 'streakDays', 'notes'];
  }

  private getExerciseTemplateHeaders(): string[] {
    return ['id', 'name', 'description', 'category', 'type', 'estimatedDuration', 'instructions', 'questions', 'tags', 'createdBy', 'isPublic', 'usageCount', 'createdAt', 'updatedAt'];
  }

  private getClientEngagementMetricsHeaders(): string[] {
    return ['id', 'clientId', 'consultantId', 'date', 'loginCount', 'sessionDuration', 'exercisesViewed', 'exercisesStarted', 'exercisesCompleted', 'messagesReceived', 'messagesRead', 'lastActiveAt', 'createdAt'];
  }

  private getExercisePerformanceMetricsHeaders(): string[] {
    return ['id', 'exerciseId', 'clientId', 'assignmentId', 'submissionId', 'startedAt', 'completedAt', 'timeSpent', 'difficultyRating', 'satisfactionRating', 'score', 'attempts', 'hintsUsed', 'notes', 'createdAt'];
  }

  private getConsultantAnalyticsHeaders(): string[] {
    return ['id', 'consultantId', 'period', 'periodStart', 'periodEnd', 'totalClients', 'activeClients', 'newClients', 'exercisesCreated', 'exercisesAssigned', 'exercisesCompleted', 'totalCompletionRate', 'avgClientEngagement', 'totalConsultations', 'consultationDuration', 'clientRetentionRate', 'createdAt'];
  }

  private getClientAnalyticsSummaryHeaders(): string[] {
    return ['id', 'clientId', 'consultantId', 'period', 'periodStart', 'periodEnd', 'totalExercisesAssigned', 'totalExercisesCompleted', 'completionRate', 'avgCompletionTime', 'avgScore', 'avgDifficultyRating', 'avgSatisfactionRating', 'totalSessionTime', 'loginFrequency', 'engagementScore', 'streakDays', 'goalsSet', 'goalsAchieved', 'createdAt'];
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    return users.find(user => user.id === id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    return users.find(user => user.email === email);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    return users.find(user => user.username === username);
  }

  async getUsersByRole(role: "client" | "consultant"): Promise<User[]> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    return users.filter(user => user.role === role);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    const user: User = {
      ...insertUser,
      id: randomUUID(),
      createdAt: new Date(),
    };
    users.push(user);
    this.writeCSV('users', users, this.getUserHeaders());
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    const index = users.findIndex(user => user.id === id);
    if (index === -1) return undefined;

    users[index] = { ...users[index], ...updates };
    this.writeCSV('users', users, this.getUserHeaders());
    return users[index];
  }

  async getClientsByConsultant(consultantId: string): Promise<User[]> {
    const users = this.readCSV<User>('users', this.getUserHeaders());
    return users.filter(user => user.role === 'client' && user.consultantId === consultantId);
  }

  // Exercise operations
  async getExercise(id: string): Promise<Exercise | undefined> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    return exercises.find(exercise => exercise.id === id);
  }

  async createExercise(insertExercise: InsertExercise, createdBy: string): Promise<Exercise> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    const exercise: Exercise = {
      ...insertExercise,
      id: randomUUID(),
      createdBy,
      createdAt: new Date(),
    };
    exercises.push(exercise);
    this.writeCSV('exercises', exercises, this.getExerciseHeaders());
    return exercise;
  }

  async updateExercise(id: string, updates: Partial<Exercise>): Promise<Exercise | undefined> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    const index = exercises.findIndex(exercise => exercise.id === id);
    if (index === -1) return undefined;

    exercises[index] = { ...exercises[index], ...updates };
    this.writeCSV('exercises', exercises, this.getExerciseHeaders());
    return exercises[index];
  }

  async deleteExercise(id: string): Promise<boolean> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    const index = exercises.findIndex(exercise => exercise.id === id);
    if (index === -1) return false;

    exercises.splice(index, 1);
    this.writeCSV('exercises', exercises, this.getExerciseHeaders());
    return true;
  }

  async getExercisesByConsultant(consultantId: string): Promise<Exercise[]> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    return exercises.filter(exercise => exercise.createdBy === consultantId);
  }

  async getGeneralExercises(): Promise<Exercise[]> {
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    return exercises.filter(exercise => exercise.type === "general");
  }

  // Exercise assignment operations
  async createExerciseAssignment(insertAssignment: InsertExerciseAssignment): Promise<ExerciseAssignment> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const assignment: ExerciseAssignment = {
      ...insertAssignment,
      id: randomUUID(),
      status: insertAssignment.status || "pending",
      assignedAt: new Date(),
      completedAt: null,
    };
    assignments.push(assignment);
    this.writeCSV('exerciseAssignments', assignments, this.getExerciseAssignmentHeaders());
    return assignment;
  }

  async getExerciseAssignment(id: string): Promise<ExerciseAssignment | undefined> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    return assignments.find(assignment => assignment.id === id);
  }

  async getAssignmentsByClient(clientId: string): Promise<(ExerciseAssignment & { exercise: Exercise, consultant: User })[]> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    const users = this.readCSV<User>('users', this.getUserHeaders());

    const clientAssignments = assignments.filter(assignment => assignment.clientId === clientId);
    return clientAssignments.map(assignment => {
      const exercise = exercises.find(ex => ex.id === assignment.exerciseId);
      const consultant = users.find(user => user.id === assignment.consultantId);
      return { ...assignment, exercise: exercise!, consultant: consultant! };
    }).filter(item => item.exercise && item.consultant);
  }

  async getAssignmentsByConsultant(consultantId: string): Promise<(ExerciseAssignment & { exercise: Exercise, client: User })[]> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const exercises = this.readCSV<Exercise>('exercises', this.getExerciseHeaders());
    const users = this.readCSV<User>('users', this.getUserHeaders());

    const consultantAssignments = assignments.filter(assignment => assignment.consultantId === consultantId);
    return consultantAssignments.map(assignment => {
      const exercise = exercises.find(ex => ex.id === assignment.exerciseId);
      const client = users.find(user => user.id === assignment.clientId);
      return { ...assignment, exercise: exercise!, client: client! };
    }).filter(item => item.exercise && item.client);
  }

  async updateAssignmentStatus(id: string, status: "pending" | "in_progress" | "submitted" | "completed" | "rejected"): Promise<ExerciseAssignment | undefined> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const index = assignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return undefined;

    assignments[index] = {
      ...assignments[index],
      status,
      submittedAt: status === "submitted" ? new Date() : assignments[index].submittedAt,
      completedAt: status === "completed" ? new Date() : assignments[index].completedAt
    };
    this.writeCSV('exerciseAssignments', assignments, this.getExerciseAssignmentHeaders());
    return assignments[index];
  }

  async rejectAssignment(id: string, updates: {
    consultantFeedback: string;
    reviewedAt: Date;
  }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const index = assignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return undefined;

    const assignment = assignments[index];

    // Handle consultant feedback as array to maintain history
    let updatedFeedback = assignment.consultantFeedback || [];

    // If consultantFeedback is currently a string (legacy format), convert to array
    if (typeof assignment.consultantFeedback === 'string') {
      updatedFeedback = assignment.consultantFeedback ? [{ feedback: assignment.consultantFeedback, timestamp: assignment.reviewedAt ? new Date(assignment.reviewedAt).toISOString() : new Date().toISOString() }] : [];
    }

    // Add rejection feedback only if it's provided and not empty
    if (updates.consultantFeedback && updates.consultantFeedback.trim()) {
      updatedFeedback.push({ feedback: updates.consultantFeedback, timestamp: new Date().toISOString() });
    }

    assignments[index] = {
      ...assignment,
      ...updates,
      consultantFeedback: updatedFeedback,
      status: 'rejected',
    };

    this.writeCSV('exerciseAssignments', assignments, this.getExerciseAssignmentHeaders());
    return assignments[index];
  }

  async reviewAssignment(id: string, updates: {
    score: number;
    consultantFeedback: string;
    status: string;
    reviewedAt: Date;
    completedAt: Date;
  }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const index = assignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return undefined;

    const assignment = assignments[index];

    // Handle consultant feedback as array to maintain history
    let updatedFeedback = assignment.consultantFeedback || [];

    // If consultantFeedback is currently a string (legacy format), convert to array
    if (typeof assignment.consultantFeedback === 'string') {
      updatedFeedback = assignment.consultantFeedback ? [{ feedback: assignment.consultantFeedback, timestamp: assignment.reviewedAt?.toISOString() || new Date().toISOString() }] : [];
    }

    // Add new feedback only if it's provided and not empty
    if (updates.consultantFeedback && updates.consultantFeedback.trim()) {
      updatedFeedback.push({ feedback: updates.consultantFeedback, timestamp: new Date().toISOString() });
    }

    assignments[index] = {
      ...assignment,
      ...updates,
      consultantFeedback: updatedFeedback,
    };

    this.writeCSV('exerciseAssignments', assignments, this.getExerciseAssignmentHeaders());
    return assignments[index];
  }

  async returnAssignmentToClient(id: string, updates: {
    consultantFeedback: string;
    status: string;
    reviewedAt: Date;
  }, createdBy: string): Promise<ExerciseAssignment | undefined> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const index = assignments.findIndex(assignment => assignment.id === id);
    if (index === -1) return undefined;

    const assignment = assignments[index];

    // Handle consultant feedback as array to maintain history
    let updatedFeedback = assignment.consultantFeedback || [];

    // If consultantFeedback is currently a string (legacy format), convert to array
    if (typeof assignment.consultantFeedback === 'string') {
      updatedFeedback = assignment.consultantFeedback ? [{ feedback: assignment.consultantFeedback, timestamp: assignment.reviewedAt?.toISOString() || new Date().toISOString() }] : [];
    }

    // Add return feedback
    updatedFeedback.push({ feedback: updates.consultantFeedback, timestamp: new Date().toISOString() });

    assignments[index] = {
      ...assignment,
      ...updates,
      consultantFeedback: updatedFeedback,
      submittedAt: undefined, // Reset submission date to allow resubmission
      completedAt: undefined, // Reset completion date
    };

    this.writeCSV('exerciseAssignments', assignments, this.getExerciseAssignmentHeaders());
    return assignments[index];
  }

  // Exercise submission operations
  async createExerciseSubmission(insertSubmission: InsertExerciseSubmission): Promise<ExerciseSubmission> {
    const submissions = this.readCSV<ExerciseSubmission>('exerciseSubmissions', this.getExerciseSubmissionHeaders());
    const submission: ExerciseSubmission = {
      ...insertSubmission,
      id: randomUUID(),
      attachments: insertSubmission.attachments || [],
      submittedAt: new Date(),
    };
    submissions.push(submission);
    this.writeCSV('exerciseSubmissions', submissions, this.getExerciseSubmissionHeaders());
    return submission;
  }

  async getSubmissionsByAssignment(assignmentId: string): Promise<ExerciseSubmission[]> {
    const submissions = this.readCSV<ExerciseSubmission>('exerciseSubmissions', this.getExerciseSubmissionHeaders());
    return submissions.filter(submission => submission.assignmentId === assignmentId);
  }

  async getExerciseSubmissionByAssignment(assignmentId: string): Promise<ExerciseSubmission | undefined> {
    const submissions = this.readCSV<ExerciseSubmission>('exerciseSubmissions', this.getExerciseSubmissionHeaders());
    return submissions.find(submission => submission.assignmentId === assignmentId);
  }

  // Consultation operations
  async createConsultation(insertConsultation: InsertConsultation): Promise<Consultation> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const consultation: Consultation = {
      ...insertConsultation,
      id: randomUUID(),
      status: insertConsultation.status || "scheduled",
      createdAt: new Date(),
    };
    consultations.push(consultation);
    this.writeCSV('consultations', consultations, this.getConsultationHeaders());
    return consultation;
  }

  async getConsultationsByClient(clientId: string): Promise<(Consultation & { consultant: User })[]> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const users = this.readCSV<User>('users', this.getUserHeaders());

    const clientConsultations = consultations.filter(consultation => consultation.clientId === clientId);
    return clientConsultations.map(consultation => {
      const consultant = users.find(user => user.id === consultation.consultantId);
      return { ...consultation, consultant: consultant! };
    }).filter(item => item.consultant);
  }

  async getConsultationsByConsultant(consultantId: string): Promise<(Consultation & { client: User })[]> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const users = this.readCSV<User>('users', this.getUserHeaders());

    const consultantConsultations = consultations.filter(consultation => consultation.consultantId === consultantId);
    return consultantConsultations.map(consultation => {
      const client = users.find(user => user.id === consultation.clientId);
      return { ...consultation, client: client! };
    }).filter(item => item.client);
  }

  async updateConsultation(id: string, updates: Partial<Consultation>): Promise<Consultation | undefined> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const index = consultations.findIndex(consultation => consultation.id === id);
    if (index === -1) return undefined;

    consultations[index] = { ...consultations[index], ...updates };
    this.writeCSV('consultations', consultations, this.getConsultationHeaders());
    return consultations[index];
  }

  async getConsultation(id: string): Promise<Consultation | undefined> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    return consultations.find(consultation => consultation.id === id);
  }

  async deleteConsultation(id: string): Promise<boolean> {
    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const originalLength = consultations.length;
    const filteredConsultations = consultations.filter(consultation => consultation.id !== id);

    if (filteredConsultations.length < originalLength) {
      this.writeCSV('consultations', filteredConsultations, this.getConsultationHeaders());
      return true;
    }
    return false;
  }

  // Goal operations
  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const goals = this.readCSV<Goal>('goals', this.getGoalHeaders());
    const goal: Goal = {
      ...insertGoal,
      id: randomUUID(),
      status: insertGoal.status || "active",
      description: insertGoal.description || null,
      createdAt: new Date(),
    };
    goals.push(goal);
    this.writeCSV('goals', goals, this.getGoalHeaders());
    return goal;
  }

  async getGoalsByClient(clientId: string): Promise<Goal[]> {
    const goals = this.readCSV<Goal>('goals', this.getGoalHeaders());
    return goals.filter(goal => goal.clientId === clientId);
  }

  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined> {
    const goals = this.readCSV<Goal>('goals', this.getGoalHeaders());
    const index = goals.findIndex(goal => goal.id === id);
    if (index === -1) return undefined;

    goals[index] = { ...goals[index], ...updates };
    this.writeCSV('goals', goals, this.getGoalHeaders());
    return goals[index];
  }

  // Progress operations
  async createClientProgress(insertProgress: InsertClientProgress): Promise<ClientProgress> {
    const progressData = this.readCSV<ClientProgress>('clientProgress', this.getClientProgressHeaders());
    const progress: ClientProgress = {
      ...insertProgress,
      id: randomUUID(),
      notes: insertProgress.notes || null,
      exercisesCompleted: insertProgress.exercisesCompleted || null,
      totalExercises: insertProgress.totalExercises || null,
      streakDays: insertProgress.streakDays || null,
    };
    progressData.push(progress);
    this.writeCSV('clientProgress', progressData, this.getClientProgressHeaders());
    return progress;
  }

  async getClientProgress(clientId: string, date?: Date): Promise<ClientProgress[]> {
    const progressData = this.readCSV<ClientProgress>('clientProgress', this.getClientProgressHeaders());
    let progress = progressData.filter(p => p.clientId === clientId);

    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      progress = progress.filter(p => p.date && p.date.toISOString().split('T')[0] === dateStr);
    }

    return progress.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }

  async updateClientProgress(clientId: string, date: Date, updates: Partial<ClientProgress>): Promise<ClientProgress | undefined> {
    const progressData = this.readCSV<ClientProgress>('clientProgress', this.getClientProgressHeaders());
    const dateStr = date.toISOString().split('T')[0];
    const index = progressData.findIndex(p => p.clientId === clientId && p.date?.toISOString().split('T')[0] === dateStr);

    if (index !== -1) {
      progressData[index] = { ...progressData[index], ...updates };
      this.writeCSV('clientProgress', progressData, this.getClientProgressHeaders());
      return progressData[index];
    }

    return undefined;
  }

  // Exercise template operations
  async createExerciseTemplate(template: InsertExerciseTemplate, createdBy: string): Promise<ExerciseTemplate> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    const now = new Date();
    const exerciseTemplate: ExerciseTemplate = {
      ...template,
      id: randomUUID(),
      createdBy,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    templates.push(exerciseTemplate);
    this.writeCSV('exerciseTemplates', templates, this.getExerciseTemplateHeaders());
    return exerciseTemplate;
  }

  async getExerciseTemplate(id: string): Promise<ExerciseTemplate | undefined> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    return templates.find(template => template.id === id);
  }

  async getExerciseTemplatesByConsultant(consultantId: string): Promise<ExerciseTemplate[]> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    return templates
      .filter(template => template.createdBy === consultantId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getPublicExerciseTemplates(): Promise<ExerciseTemplate[]> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    return templates
      .filter(template => template.isPublic)
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  async searchExerciseTemplates(filters: {
    category?: string;
    tags?: string[];
    type?: "general" | "personalized";
    createdBy?: string;
    isPublic?: boolean;
  }): Promise<ExerciseTemplate[]> {
    let templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());

    if (filters.category) {
      templates = templates.filter(t => t.category.toLowerCase().includes(filters.category!.toLowerCase()));
    }

    if (filters.tags && filters.tags.length > 0) {
      templates = templates.filter(t =>
        filters.tags!.some(tag =>
          t.tags.some(templateTag => templateTag.toLowerCase().includes(tag.toLowerCase()))
        )
      );
    }

    if (filters.type) {
      templates = templates.filter(t => t.type === filters.type);
    }

    if (filters.createdBy) {
      templates = templates.filter(t => t.createdBy === filters.createdBy);
    }

    if (filters.isPublic !== undefined) {
      templates = templates.filter(t => t.isPublic === filters.isPublic);
    }

    return templates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateExerciseTemplate(id: string, updates: Partial<ExerciseTemplate>): Promise<ExerciseTemplate | undefined> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return undefined;

    templates[index] = {
      ...templates[index],
      ...updates,
      updatedAt: new Date()
    };
    this.writeCSV('exerciseTemplates', templates, this.getExerciseTemplateHeaders());
    return templates[index];
  }

  async deleteExerciseTemplate(id: string): Promise<boolean> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return false;

    templates.splice(index, 1);
    this.writeCSV('exerciseTemplates', templates, this.getExerciseTemplateHeaders());
    return true;
  }

  async incrementTemplateUsage(id: string): Promise<ExerciseTemplate | undefined> {
    const templates = this.readCSV<ExerciseTemplate>('exerciseTemplates', this.getExerciseTemplateHeaders());
    const index = templates.findIndex(template => template.id === id);
    if (index === -1) return undefined;

    templates[index] = {
      ...templates[index],
      usageCount: templates[index].usageCount + 1,
      updatedAt: new Date()
    };
    this.writeCSV('exerciseTemplates', templates, this.getExerciseTemplateHeaders());
    return templates[index];
  }

  async copyTemplateToExercise(templateId: string, createdBy: string): Promise<Exercise> {
    const template = await this.getExerciseTemplate(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    await this.incrementTemplateUsage(templateId);

    const exerciseData: InsertExercise = {
      title: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      estimatedDuration: template.estimatedDuration,
      instructions: template.instructions,
      attachments: [],
      questions: template.questions,
    };

    return this.createExercise(exerciseData, createdBy);
  }

  // Analytics operations (simplified implementations)
  async createClientEngagementMetrics(insertMetrics: InsertClientEngagementMetrics): Promise<ClientEngagementMetrics> {
    const metrics = this.readCSV<ClientEngagementMetrics>('clientEngagementMetrics', this.getClientEngagementMetricsHeaders());
    const metric: ClientEngagementMetrics = {
      ...insertMetrics,
      id: randomUUID(),
      createdAt: new Date(),
    };
    metrics.push(metric);
    this.writeCSV('clientEngagementMetrics', metrics, this.getClientEngagementMetricsHeaders());
    return metric;
  }

  async getClientEngagementMetrics(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<ClientEngagementMetrics[]> {
    const metrics = this.readCSV<ClientEngagementMetrics>('clientEngagementMetrics', this.getClientEngagementMetricsHeaders());
    let filtered = metrics.filter(m => m.clientId === clientId && m.consultantId === consultantId);

    if (startDate) {
      filtered = filtered.filter(m => m.date >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(m => m.date <= endDate);
    }

    return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async updateClientEngagementMetrics(id: string, updates: Partial<ClientEngagementMetrics>): Promise<ClientEngagementMetrics | undefined> {
    const metrics = this.readCSV<ClientEngagementMetrics>('clientEngagementMetrics', this.getClientEngagementMetricsHeaders());
    const index = metrics.findIndex(metric => metric.id === id);
    if (index === -1) return undefined;

    metrics[index] = { ...metrics[index], ...updates };
    this.writeCSV('clientEngagementMetrics', metrics, this.getClientEngagementMetricsHeaders());
    return metrics[index];
  }

  async createExercisePerformanceMetrics(insertMetrics: InsertExercisePerformanceMetrics): Promise<ExercisePerformanceMetrics> {
    const metrics = this.readCSV<ExercisePerformanceMetrics>('exercisePerformanceMetrics', this.getExercisePerformanceMetricsHeaders());
    const metric: ExercisePerformanceMetrics = {
      ...insertMetrics,
      id: randomUUID(),
      createdAt: new Date(),
    };
    metrics.push(metric);
    this.writeCSV('exercisePerformanceMetrics', metrics, this.getExercisePerformanceMetricsHeaders());
    return metric;
  }

  async getExercisePerformanceMetrics(exerciseId?: string, clientId?: string, assignmentId?: string): Promise<ExercisePerformanceMetrics[]> {
    const metrics = this.readCSV<ExercisePerformanceMetrics>('exercisePerformanceMetrics', this.getExercisePerformanceMetricsHeaders());
    let filtered = metrics;

    if (exerciseId) {
      filtered = filtered.filter(m => m.exerciseId === exerciseId);
    }

    if (clientId) {
      filtered = filtered.filter(m => m.clientId === clientId);
    }

    if (assignmentId) {
      filtered = filtered.filter(m => m.assignmentId === assignmentId);
    }

    return filtered.sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));
  }

  async updateExercisePerformanceMetrics(id: string, updates: Partial<ExercisePerformanceMetrics>): Promise<ExercisePerformanceMetrics | undefined> {
    const metrics = this.readCSV<ExercisePerformanceMetrics>('exercisePerformanceMetrics', this.getExercisePerformanceMetricsHeaders());
    const index = metrics.findIndex(metric => metric.id === id);
    if (index === -1) return undefined;

    metrics[index] = { ...metrics[index], ...updates };
    this.writeCSV('exercisePerformanceMetrics', metrics, this.getExercisePerformanceMetricsHeaders());
    return metrics[index];
  }

  // Stub implementations for remaining methods
  async createConsultantAnalytics(insertAnalytics: InsertConsultantAnalytics): Promise<ConsultantAnalytics> {
    const analytics = this.readCSV<ConsultantAnalytics>('consultantAnalytics', this.getConsultantAnalyticsHeaders());
    const analytic: ConsultantAnalytics = {
      ...insertAnalytics,
      id: randomUUID(),
      createdAt: new Date(),
    };
    analytics.push(analytic);
    this.writeCSV('consultantAnalytics', analytics, this.getConsultantAnalyticsHeaders());
    return analytic;
  }

  async getConsultantAnalytics(consultantId: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ConsultantAnalytics[]> {
    // Delegating to superclass, assuming MemStorage has this implementation
    return super.getConsultantAnalytics(consultantId, period, startDate, endDate);
  }

  async updateConsultantAnalytics(id: string, updates: Partial<ConsultantAnalytics>): Promise<ConsultantAnalytics | undefined> {
    // Delegating to superclass
    return super.updateConsultantAnalytics(id, updates);
  }

  async createClientAnalyticsSummary(insertSummary: InsertClientAnalyticsSummary): Promise<ClientAnalyticsSummary> {
    const summaries = this.readCSV<ClientAnalyticsSummary>('clientAnalyticsSummary', this.getClientAnalyticsSummaryHeaders());
    const summary: ClientAnalyticsSummary = {
      ...insertSummary,
      id: randomUUID(),
      createdAt: new Date(),
    };
    summaries.push(summary);
    this.writeCSV('clientAnalyticsSummary', summaries, this.getClientAnalyticsSummaryHeaders());
    return summary;
  }

  async getClientAnalyticsSummary(clientId?: string, consultantId?: string, period?: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<ClientAnalyticsSummary[]> {
    // Delegating to superclass
    return super.getClientAnalyticsSummary(clientId, consultantId, period, startDate, endDate);
  }

  async updateClientAnalyticsSummary(id: string, updates: Partial<ClientAnalyticsSummary>): Promise<ClientAnalyticsSummary | undefined> {
    // Delegating to superclass
    return super.updateClientAnalyticsSummary(id, updates);
  }

  // Computed analytics methods
  async calculateConsultantOverallStats(consultantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalClients: number;
    activeClients: number;
    totalExercises: number;
    completedExercises: number;
    completionRate: number;
    avgClientEngagement: number;
    totalConsultations: number;
    clientRetentionRate: number;
  }> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const consultantAssignments = assignments.filter(a => a.consultantId === consultantId);

    const clientIds = Array.from(new Set(consultantAssignments.map(a => a.clientId)));
    const totalClients = clientIds.length;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentAssignments = consultantAssignments.filter(a => a.assignedAt >= thirtyDaysAgo);
    const activeClients = Array.from(new Set(recentAssignments.map(a => a.clientId))).length;

    const totalExercises = consultantAssignments.length;
    const completedExercises = consultantAssignments.filter(a => a.status === 'completed').length;
    const completionRate = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    const consultations = this.readCSV<Consultation>('consultations', this.getConsultationHeaders());
    const totalConsultations = consultations.filter(c => c.consultantId === consultantId).length;

    return {
      totalClients,
      activeClients,
      totalExercises,
      completedExercises,
      completionRate,
      avgClientEngagement: 75, // Simplified
      totalConsultations,
      clientRetentionRate: totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0,
    };
  }

  async calculateClientPerformanceStats(clientId: string, consultantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalExercisesAssigned: number;
    completedExercises: number;
    completionRate: number;
    avgCompletionTime: number;
    avgScore: number;
    avgSatisfactionRating: number;
    streakDays: number;
    engagementScore: number;
  }> {
    const assignments = this.readCSV<ExerciseAssignment>('exerciseAssignments', this.getExerciseAssignmentHeaders());
    const clientAssignments = assignments.filter(a => a.clientId === clientId && a.consultantId === consultantId);

    const totalExercisesAssigned = clientAssignments.length;
    const completedExercises = clientAssignments.filter(a => a.status === 'completed').length;
    const completionRate = totalExercisesAssigned > 0 ? Math.round((completedExercises / totalExercisesAssigned) * 100) : 0;

    return {
      totalExercisesAssigned,
      completedExercises,
      completionRate,
      avgCompletionTime: 30, // Simplified
      avgScore: 85, // Simplified
      avgSatisfactionRating: 4, // Simplified
      streakDays: 7, // Simplified
      engagementScore: 80, // Simplified
    };
  }

  async getExerciseCompletionTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{
    date: Date;
    completed: number;
    assigned: number;
    completionRate: number;
  }[]> {
    // Delegating to superclass
    return super.getExerciseCompletionTrends(consultantId, period, startDate, endDate);
  }

  async getClientEngagementTrends(consultantId: string, period: "daily" | "weekly" | "monthly", startDate?: Date, endDate?: Date): Promise<{
    date: Date;
    totalSessions: number;
    avgSessionDuration: number;
    totalLogins: number;
    activeClients: number;
  }[]> {
    // Delegating to superclass
    return super.getClientEngagementTrends(consultantId, period, startDate, endDate);
  }

  // Helper method to check if file exists
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  // Activity Logging Methods
  async createUserActivityLog(log: any): Promise<any> {
    const id = randomUUID();
    const activityLog = {
      id,
      userId: log.userId,
      activityType: log.activityType,
      timestamp: new Date(),
      details: log.details || null,
      sessionId: log.sessionId || null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
    };

    // Save to CSV file
    const csvData = [
      id,
      log.userId,
      log.activityType,
      new Date().toISOString(),
      log.details || '',
      log.sessionId || '',
      log.ipAddress || '',
      log.userAgent || ''
    ];

    try {
      const csvPath = path.join(this.dataDir, 'user_activity_logs.csv');
      const csvLine = csvData.map(field => 
        typeof field === 'string' && field.includes(',') 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(',') + '\n';

      // Check if file exists, if not create with headers
      if (!fs.existsSync(csvPath)) {
        const headers = 'id,userId,activityType,timestamp,details,sessionId,ipAddress,userAgent\n';
        fs.writeFileSync(csvPath, headers);
      }

      fs.appendFileSync(csvPath, csvLine);
      console.log(`Activity log saved: ${log.activityType} for user ${log.userId}`);
    } catch (error) {
      console.error('Error saving activity log to CSV:', error);
    }

    // Also delegate to parent for now (for compatibility)
    return super.createUserActivityLog(activityLog);
  }

  async getUserActivityLogs(userId?: string, startDate?: Date, endDate?: Date, activityType?: string): Promise<any[]> {
    // Load from CSV file
    try {
      const csvPath = path.join(this.dataDir, 'user_activity_logs.csv');
      if (!fs.existsSync(csvPath)) {
        return [];
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n').filter(line => line.trim());

      // Skip header row if present
      const dataLines = lines.length > 0 && lines[0].includes('id,userId') ? lines.slice(1) : lines;

      let logs = dataLines.map(line => {
        const [id, uid, actType, timestamp, details, sessionId, ipAddress, userAgent] = this.parseCSVLine(line);
        return {
          id,
          userId: uid,
          activityType: actType,
          timestamp: new Date(timestamp),
          details: details || null,
          sessionId: sessionId || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        };
      });

      // Apply filters
      if (userId) logs = logs.filter(log => log.userId === userId);
      if (startDate) logs = logs.filter(log => log.timestamp >= startDate);
      if (endDate) logs = logs.filter(log => log.timestamp <= endDate);
      if (activityType) logs = logs.filter(log => log.activityType === activityType);

      // Remove duplicates based on userId, activityType, and details within 5 seconds
      const uniqueLogs = logs.filter((log, index, arr) => {
        const duplicates = arr.filter(otherLog => 
          otherLog.userId === log.userId &&
          otherLog.activityType === log.activityType &&
          otherLog.details === log.details &&
          Math.abs(otherLog.timestamp.getTime() - log.timestamp.getTime()) < 5000
        );
        
        // Keep only the first occurrence of duplicates
        return duplicates[0].id === log.id;
      });

      return uniqueLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Error loading activity logs from CSV:', error);
      return super.getUserActivityLogs(userId, startDate, endDate, activityType);
    }
  }

  async getUserActivityLogsByConsultant(consultantId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    console.log('CSVStorage: getUserActivityLogsByConsultant called for:', consultantId);

    // Get consultant's clients first
    const clients = await this.getClientsByConsultant(consultantId);
    const clientIds = clients.map(client => client.id);

    console.log('CSVStorage: Client IDs for consultant:', clientIds);

    // Get all activity logs and filter by client IDs
    const allLogs = await this.getUserActivityLogs();
    let logs = allLogs.filter(log => clientIds.includes(log.userId));

    console.log('CSVStorage: Filtered activity logs for clients:', logs.length);

    // Apply date filters if provided
    if (startDate) logs = logs.filter(log => log.timestamp >= startDate);
    if (endDate) logs = logs.filter(log => log.timestamp <= endDate);

    const sortedLogs = logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    console.log('CSVStorage: Final activity logs to return:', sortedLogs.length);

    return sortedLogs;
  }

  // User Session Management Methods
  async createUserSession(session: any): Promise<any> {
    const id = randomUUID();
    const userSession = {
      id,
      userId: session.userId,
      sessionId: session.sessionId,
      startTime: new Date(),
      endTime: undefined,
      lastActivity: new Date(),
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
    };

    // Save to CSV file
    const csvData = [
      id,
      session.userId,
      session.sessionId,
      new Date().toISOString(),
      '', // endTime (empty initially)
      new Date().toISOString(), // lastActivity
      session.ipAddress || '',
      session.userAgent || ''
    ];

    try {
      const csvPath = path.join(this.dataDir, 'user_sessions.csv');

      // Check if file exists, if not create with headers
      if (!fs.existsSync(csvPath)) {
        const headers = 'id,userId,sessionId,startTime,endTime,lastActivity,ipAddress,userAgent\n';
        fs.writeFileSync(csvPath, headers);
      }

      const csvLine = csvData.map(field => 
        typeof field === 'string' && field.includes(',') 
          ? `"${field.replace(/"/g, '""')}"` 
          : field
      ).join(',') + '\n';

      fs.appendFileSync(csvPath, csvLine);
      console.log(`User session created: ${session.sessionId} for user ${session.userId}`);
    } catch (error) {
      console.error('Error saving user session to CSV:', error);
    }

    // Also delegate to parent for now (for compatibility)
    return super.createUserSession(userSession);
  }

  async getUserSession(sessionId: string): Promise<any> {
    // Load from CSV file
    try {
      const csvPath = path.join(this.dataDir, 'user_sessions.csv');
      if (!fs.existsSync(csvPath)) {
        return super.getUserSession(sessionId);
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const [id, userId, sessId, startTime, endTime, lastActivity, ipAddress, userAgent] = this.parseCSVLine(line);
        if (sessId === sessionId) {
          return {
            id,
            userId,
            sessionId: sessId,
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : undefined,
            lastActivity: new Date(lastActivity),
            ipAddress: ipAddress || null,
            userAgent: userAgent || null,
          };
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error loading user session from CSV:', error);
      return super.getUserSession(sessionId);
    }
  }

  async updateUserSession(sessionId: string, updates: any): Promise<any> {
    // For now, delegate to parent (CSV updates are complex)
    return super.updateUserSession(sessionId, updates);
  }

  async getActiveUserSessions(consultantId?: string): Promise<any[]> {
    console.log('CSVStorage: getActiveUserSessions called for consultant:', consultantId);

    if (!consultantId) {
      return super.getActiveUserSessions(consultantId);
    }

    // Get consultant's clients first
    const clients = await this.getClientsByConsultant(consultantId);
    const clientIds = clients.map(c => c.id);

    console.log('CSVStorage: Client IDs for consultant:', clientIds);

    // Load all sessions from CSV
    try {
      const csvPath = path.join(this.dataDir, 'user_sessions.csv');
      if (!fs.existsSync(csvPath)) {
        console.log('CSVStorage: No sessions CSV file found');
        return [];
      }

      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.trim().split('\n').filter(line => line.trim());

      // Skip header row if present
      const dataLines = lines.length > 0 && lines[0].includes('id,userId') ? lines.slice(1) : lines;

      const sessions = dataLines.map(line => {
        const [id, userId, sessId, startTime, endTime, lastActivity, ipAddress, userAgent] = this.parseCSVLine(line);
        return {
          id,
          userId,
          sessionId: sessId,
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : undefined,
          lastActivity: new Date(lastActivity),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        };
      });

      // Filter for active sessions of consultant's clients
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      let activeSessions = sessions.filter(session => 
        !session.endTime && 
        clientIds.includes(session.userId) &&
        session.startTime > oneHourAgo
      );

      // Remove duplicate sessions for the same user (keep the most recent)
      const uniqueSessions = new Map();
      activeSessions.forEach(session => {
        const existing = uniqueSessions.get(session.userId);
        if (!existing || session.startTime > existing.startTime) {
          uniqueSessions.set(session.userId, session);
        }
      });

      activeSessions = Array.from(uniqueSessions.values());
      console.log('CSVStorage: Active sessions found:', activeSessions.length);
      return activeSessions;
    } catch (error) {
      console.error('Error loading active sessions from CSV:', error);
      return super.getActiveUserSessions(consultantId);
    }
  }

  async endUserSession(sessionId: string): Promise<any> {
    // For now, delegate to parent (CSV updates are complex)
    return super.endUserSession(sessionId);
  }

  // Helper methods for CSV operations would go here
  // This is a simplified implementation - in production you'd want proper CSV handling
}