import * as fs from 'fs';
import * as path from 'path';
import { db } from './db';
import * as schema from '@shared/schema';

interface CSVRow {
  [key: string]: string;
}

export class DataMigrator {
  private dataDir = path.join(process.cwd(), '../data');

  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < row.length) {
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
      i++;
    }

    result.push(current);
    return result;
  }

  private readCSV(filename: string): CSVRow[] {
    const filePath = path.join(this.dataDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filename} not found, skipping...`);
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse CSV respecting quotes and multi-line fields
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < content.length) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator outside quotes
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        // Row separator outside quotes
        if (currentField.length > 0 || currentRow.length > 0) {
          currentRow.push(currentField);
          if (currentRow.some(field => field.trim().length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
        }
        // Skip \r\n combination
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else if (char !== '\r') {
        // Regular character (skip \r characters)
        currentField += char;
      }
      
      i++;
    }

    // Add last field and row if any
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(field => field.trim().length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return [];

    const headers = rows[0];
    const result: CSVRow[] = [];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      if (values.length === headers.length) {
        const row: CSVRow = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = values[j] || '';
        }
        result.push(row);
      } else {
        console.log(`⚠️ Skipping malformed row ${i + 1}: expected ${headers.length} columns, got ${values.length}`);
      }
    }

    return result;
  }

  private parseValue(value: string, type: 'string' | 'number' | 'boolean' | 'date' | 'json'): any {
    if (!value || value === '') return null;

    switch (type) {
      case 'number':
        const num = parseInt(value);
        return isNaN(num) ? null : num;
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'date':
        if (!value || value === '') return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
      case 'json':
        if (!value || value === '') return [];
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      default:
        return value || null;
    }
  }

  async migrateUsers() {
    console.log('Migrating users...');
    const rows = this.readCSV('users.csv');
    let successCount = 0;
    let skipCount = 0;
    
    for (const row of rows) {
      try {
        await db.insert(schema.users).values({
          id: row.id,
          username: row.username,
          email: row.email,
          password: row.password,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role as 'consultant' | 'client',
          avatar: row.avatar || null,
          consultantId: row.consultantId || null,
          createdAt: this.parseValue(row.createdAt, 'date'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating user ${row.username}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} users, skipped ${skipCount} invalid records`);
  }

  async migrateExercises() {
    console.log('Migrating exercises...');
    const rows = this.readCSV('exercises.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // First, get all valid user IDs to validate foreign keys
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Skip exercises with empty or invalid createdBy
        if (!row.createdBy || row.createdBy.trim() === '') {
          console.log(`⚠️ Skipping exercise "${row.title}" - missing createdBy`);
          skipCount++;
          continue;
        }
        
        // Validate that createdBy user exists
        if (!validUserIds.has(row.createdBy)) {
          console.log(`⚠️ Skipping exercise "${row.title}" - createdBy user "${row.createdBy}" doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.exercises).values({
          id: row.id,
          title: row.title,
          description: row.description,
          type: row.type as 'general' | 'personalized',
          category: row.category,
          estimatedDuration: this.parseValue(row.estimatedDuration, 'number'),
          instructions: row.instructions || null,
          attachments: this.parseValue(row.attachments, 'json'),
          questions: this.parseValue(row.questions, 'json'),
          workPlatform: row.workPlatform || null,
          createdBy: row.createdBy,
          createdAt: this.parseValue(row.createdAt, 'date'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating exercise "${row.title}":`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} exercises, skipped ${skipCount} invalid records`);
  }

  async migrateExerciseAssignments() {
    console.log('Migrating exercise assignments...');
    const rows = this.readCSV('exerciseAssignments.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid foreign key references
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validExercises = await db.select({ id: schema.exercises.id }).from(schema.exercises);
    const validUserIds = new Set(validUsers.map(u => u.id));
    const validExerciseIds = new Set(validExercises.map(e => e.id));
    
    for (const row of rows) {
      try {
        // Validate foreign keys
        if (!validExerciseIds.has(row.exerciseId)) {
          console.log(`⚠️ Skipping assignment ${row.id} - exercise ${row.exerciseId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        if (!validUserIds.has(row.clientId)) {
          console.log(`⚠️ Skipping assignment ${row.id} - client ${row.clientId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        if (!validUserIds.has(row.consultantId)) {
          console.log(`⚠️ Skipping assignment ${row.id} - consultant ${row.consultantId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.exerciseAssignments).values({
          id: row.id,
          exerciseId: row.exerciseId,
          clientId: row.clientId,
          consultantId: row.consultantId,
          assignedAt: this.parseValue(row.assignedAt, 'date'),
          dueDate: this.parseValue(row.dueDate, 'date'),
          status: row.status as any,
          completedAt: this.parseValue(row.completedAt, 'date'),
          submittedAt: this.parseValue(row.submittedAt, 'date'),
          reviewedAt: this.parseValue(row.reviewedAt, 'date'),
          score: this.parseValue(row.score, 'number'),
          consultantFeedback: this.parseValue(row.consultantFeedback, 'json'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating assignment ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} exercise assignments, skipped ${skipCount} invalid records`);
  }

  async migrateExerciseSubmissions() {
    console.log('Migrating exercise submissions...');
    const rows = this.readCSV('exerciseSubmissions.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid assignment IDs
    const validAssignments = await db.select({ id: schema.exerciseAssignments.id }).from(schema.exerciseAssignments);
    const validAssignmentIds = new Set(validAssignments.map(a => a.id));
    
    for (const row of rows) {
      try {
        // Validate foreign key
        if (!validAssignmentIds.has(row.assignmentId)) {
          console.log(`⚠️ Skipping submission ${row.id} - assignment ${row.assignmentId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.exerciseSubmissions).values({
          id: row.id,
          assignmentId: row.assignmentId,
          answers: this.parseValue(row.answers, 'json'),
          attachments: this.parseValue(row.attachments, 'json'),
          notes: row.notes || null,
          submittedAt: this.parseValue(row.submittedAt, 'date'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating submission ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} exercise submissions, skipped ${skipCount} invalid records`);
  }

  async migrateConsultations() {
    console.log('Migrating consultations...');
    const rows = this.readCSV('consultations.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid user IDs
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Validate foreign keys
        if (!validUserIds.has(row.consultantId)) {
          console.log(`⚠️ Skipping consultation ${row.id} - consultant ${row.consultantId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        if (!validUserIds.has(row.clientId)) {
          console.log(`⚠️ Skipping consultation ${row.id} - client ${row.clientId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.consultations).values({
          id: row.id,
          consultantId: row.consultantId,
          clientId: row.clientId,
          scheduledAt: this.parseValue(row.scheduledAt, 'date'),
          duration: this.parseValue(row.duration, 'number'),
          notes: row.notes || null,
          status: row.status as any,
          createdAt: this.parseValue(row.createdAt, 'date'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating consultation ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} consultations, skipped ${skipCount} invalid records`);
  }

  async migrateGoals() {
    console.log('Migrating goals...');
    const rows = this.readCSV('goals.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid user IDs
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Validate foreign key
        if (!validUserIds.has(row.clientId)) {
          console.log(`⚠️ Skipping goal ${row.id} - client ${row.clientId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.goals).values({
          id: row.id,
          clientId: row.clientId,
          title: row.title,
          description: row.description || null,
          targetValue: row.targetValue,
          currentValue: row.currentValue || '0',
          unit: row.unit || null,
          targetDate: this.parseValue(row.targetDate, 'date'),
          status: row.status as any,
          createdAt: this.parseValue(row.createdAt, 'date'),
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating goal ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} goals, skipped ${skipCount} invalid records`);
  }

  async migrateClientProgress() {
    console.log('Migrating client progress...');
    const rows = this.readCSV('clientProgress.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid user IDs
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Validate foreign key
        if (!validUserIds.has(row.clientId)) {
          console.log(`⚠️ Skipping client progress ${row.id} - client ${row.clientId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.clientProgress).values({
          id: row.id,
          clientId: row.clientId,
          date: this.parseValue(row.date, 'date'),
          exercisesCompleted: this.parseValue(row.exercisesCompleted, 'number'),
          totalExercises: this.parseValue(row.totalExercises, 'number'),
          streakDays: this.parseValue(row.streakDays, 'number'),
          notes: row.notes || null,
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating client progress ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} client progress records, skipped ${skipCount} invalid records`);
  }

  async migrateUserActivityLogs() {
    console.log('Migrating user activity logs...');
    const rows = this.readCSV('user_activity_logs.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid user IDs
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Validate foreign key
        if (!validUserIds.has(row.userId)) {
          console.log(`⚠️ Skipping activity log ${row.id} - user ${row.userId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.userActivityLogs).values({
          id: row.id,
          userId: row.userId,
          activityType: row.activityType as any,
          timestamp: this.parseValue(row.timestamp, 'date'),
          details: row.details || null,
          sessionId: row.sessionId || null,
          ipAddress: row.ipAddress || null,
          userAgent: row.userAgent || null,
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating activity log ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} user activity logs, skipped ${skipCount} invalid records`);
  }

  async migrateUserSessions() {
    console.log('Migrating user sessions...');
    const rows = this.readCSV('user_sessions.csv');
    let successCount = 0;
    let skipCount = 0;
    
    // Get valid user IDs
    const validUsers = await db.select({ id: schema.users.id }).from(schema.users);
    const validUserIds = new Set(validUsers.map(u => u.id));
    
    for (const row of rows) {
      try {
        // Validate foreign key
        if (!validUserIds.has(row.userId)) {
          console.log(`⚠️ Skipping user session ${row.id} - user ${row.userId} doesn't exist`);
          skipCount++;
          continue;
        }
        
        await db.insert(schema.userSessions).values({
          id: row.id,
          userId: row.userId,
          sessionId: row.sessionId,
          startTime: this.parseValue(row.startTime, 'date'),
          endTime: this.parseValue(row.endTime, 'date'),
          lastActivity: this.parseValue(row.lastActivity, 'date'),
          ipAddress: row.ipAddress || null,
          userAgent: row.userAgent || null,
        }).onConflictDoNothing();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error migrating user session ${row.id}:`, error);
        skipCount++;
      }
    }
    console.log(`✅ Migrated ${successCount} user sessions, skipped ${skipCount} invalid records`);
  }

  async migrateAll() {
    console.log('Starting data migration from CSV to PostgreSQL...');
    
    try {
      // Migrate in order of dependencies
      await this.migrateUsers();
      await this.migrateExercises();
      await this.migrateExerciseAssignments();
      await this.migrateExerciseSubmissions();
      await this.migrateConsultations();
      await this.migrateGoals();
      await this.migrateClientProgress();
      await this.migrateUserActivityLogs();
      await this.migrateUserSessions();
      
      console.log('✅ Data migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
}

// Export for use in other files
export default DataMigrator;
