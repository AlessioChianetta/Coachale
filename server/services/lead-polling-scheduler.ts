import cron from 'node-cron';
import { storage } from '../storage';
import { LeadImportService } from './lead-import-service';
import type { ExternalApiConfig } from '@shared/schema';

export class LeadPollingScheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private importService = new LeadImportService();
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      console.log('⚠️ Lead polling scheduler already initialized, skipping...');
      return;
    }

    console.log('🔄 Initializing lead polling scheduler...');

    try {
      const allConfigs = await this.getAllPollingConfigs();
      
      console.log(`📋 Found ${allConfigs.length} total configs across all consultants`);
      
      const enabledConfigs = allConfigs.filter(config => 
        config.pollingEnabled && config.isActive
      );

      console.log(`✅ Found ${enabledConfigs.length} configs with polling enabled and active`);

      for (const config of enabledConfigs) {
        try {
          await this.startPolling(config.id);
          console.log(`✅ Scheduled polling for config: ${config.configName} (${config.id}) - Interval: ${config.pollingIntervalMinutes} minutes`);
        } catch (error: any) {
          console.error(`❌ Failed to schedule polling for config ${config.id}:`, error.message);
        }
      }

      this.initialized = true;
      console.log('✅ Lead polling scheduler initialized successfully');
    } catch (error: any) {
      console.error('❌ Error initializing lead polling scheduler:', error);
      throw error;
    }
  }

  async startPolling(configId: string) {
    if (this.jobs.has(configId)) {
      console.log(`⚠️ Polling job already exists for config ${configId}, stopping old job first...`);
      await this.stopPolling(configId);
    }

    try {
      const config = await this.getConfigById(configId);
      
      if (!config) {
        throw new Error(`Configuration ${configId} not found`);
      }

      if (!config.pollingEnabled) {
        throw new Error(`Polling is not enabled for config ${configId}`);
      }

      if (!config.isActive) {
        throw new Error(`Configuration ${configId} is not active`);
      }

      const cronExpression = this.minutesToCronExpression(config.pollingIntervalMinutes);
      console.log(`📅 Creating cron job for config ${config.configName} with expression: ${cronExpression}`);

      const job = cron.schedule(cronExpression, async () => {
        await this.executeImport(configId);
      }, {
        scheduled: true,
        timezone: 'Europe/Rome'
      });

      this.jobs.set(configId, job);
      console.log(`✅ Polling started for config ${config.configName} (${configId})`);
    } catch (error: any) {
      console.error(`❌ Error starting polling for config ${configId}:`, error.message);
      throw error;
    }
  }

  async stopPolling(configId: string) {
    const job = this.jobs.get(configId);
    
    if (!job) {
      console.log(`⚠️ No active polling job found for config ${configId}`);
      return;
    }

    try {
      job.stop();
      this.jobs.delete(configId);
      console.log(`🛑 Polling stopped for config ${configId}`);
    } catch (error: any) {
      console.error(`❌ Error stopping polling for config ${configId}:`, error.message);
      throw error;
    }
  }

  async stopAll() {
    console.log('🛑 Stopping all polling jobs...');
    for (const [configId, job] of this.jobs.entries()) {
      try {
        job.stop();
        console.log(`✅ Stopped job for config ${configId}`);
      } catch (error: any) {
        console.error(`❌ Error stopping job for config ${configId}:`, error);
      }
    }
    this.jobs.clear();
    console.log('✅ All polling jobs stopped');
  }

  getActiveJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  isJobActive(configId: string): boolean {
    return this.jobs.has(configId);
  }

  private async executeImport(configId: string) {
    const executionId = Math.random().toString(36).substring(7);
    console.log(`\n📥 [ExecID:${executionId}] Starting scheduled import for config ${configId}...`);

    try {
      const config = await this.getConfigById(configId);

      if (!config) {
        console.error(`❌ [ExecID:${executionId}] Config ${configId} not found, skipping import`);
        return;
      }

      if (!config.pollingEnabled) {
        console.log(`⚠️ [ExecID:${executionId}] Polling disabled for config ${config.configName}, stopping job...`);
        await this.stopPolling(configId);
        return;
      }

      if (!config.isActive) {
        console.log(`⚠️ [ExecID:${executionId}] Config ${config.configName} is not active, skipping import`);
        return;
      }

      console.log(`🔄 [ExecID:${executionId}] Executing import for config: ${config.configName}`);
      
      const result = await this.importService.importLeadsFromExternal(config, 'scheduled');

      console.log(`✅ [ExecID:${executionId}] Import completed for ${config.configName}:`);
      console.log(`   - Imported: ${result.imported}`);
      console.log(`   - Updated: ${result.updated}`);
      console.log(`   - Duplicated: ${result.duplicated}`);
      console.log(`   - Errored: ${result.errored}`);
      
      if (result.errors.length > 0) {
        console.log(`   - First error: ${result.errors[0]}`);
      }
    } catch (error: any) {
      console.error(`❌ [ExecID:${executionId}] Fatal error during scheduled import for config ${configId}:`, error.message);
      console.error(`   Stack trace:`, error.stack);
    }
  }

  private minutesToCronExpression(minutes: number): string {
    if (minutes < 1) {
      throw new Error('Polling interval must be at least 1 minute');
    }

    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      if (days === 1) {
        return '0 0 * * *';
      } else {
        return `0 0 */${days} * *`;
      }
    }

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      if (hours === 1) {
        return '0 * * * *';
      } else if (hours < 24) {
        return `0 */${hours} * * *`;
      }
    }

    if (minutes === 1) {
      return '* * * * *';
    }

    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    }

    return `*/${minutes} * * * *`;
  }

  private async getConfigById(configId: string): Promise<ExternalApiConfig | null> {
    const allConfigs = await this.getAllPollingConfigs();
    return allConfigs.find(config => config.id === configId) || null;
  }

  private async getAllPollingConfigs(): Promise<ExternalApiConfig[]> {
    try {
      const consultants = await storage.getUsersByRole('consultant');
      const allConfigs: ExternalApiConfig[] = [];

      for (const consultant of consultants) {
        try {
          const configs = await storage.getAllExternalApiConfigs(consultant.id);
          allConfigs.push(...configs);
        } catch (error: any) {
          console.error(`Error fetching configs for consultant ${consultant.id}:`, error.message);
        }
      }

      return allConfigs;
    } catch (error: any) {
      console.error('Error fetching all polling configs:', error);
      return [];
    }
  }
}

export const pollingScheduler = new LeadPollingScheduler();
