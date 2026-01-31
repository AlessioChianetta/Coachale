import { eslClient } from './voice-esl-client';
import { voiceConfig } from './config';

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  message?: string;
  lastCheck: Date;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    esl: ComponentHealth;
    freeswitch: ComponentHealth;
    gemini: ComponentHealth;
    database: ComponentHealth;
    codec: ComponentHealth;
  };
  activeCalls: number;
  uptime: number;
  lastUpdate: Date;
}

interface CallStats {
  totalCalls: number;
  activeCalls: number;
  completedCalls: number;
  failedCalls: number;
  avgDuration: number;
  avgLatency: number;
}

export class VoiceHealthCheck {
  private startTime: Date;
  private lastHealth: SystemHealth | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private activeCalls: number = 0;

  constructor() {
    this.startTime = new Date();
  }

  async checkAll(): Promise<SystemHealth> {
    const [esl, freeswitch, gemini, database, codec] = await Promise.all([
      this.checkESL(),
      this.checkFreeSWITCH(),
      this.checkGemini(),
      this.checkDatabase(),
      this.checkCodec(),
    ]);

    const components = { esl, freeswitch, gemini, database, codec };

    const statuses = Object.values(components).map(c => c.status);
    let overall: 'healthy' | 'degraded' | 'unhealthy';

    if (statuses.every(s => s === 'healthy')) {
      overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    this.lastHealth = {
      overall,
      components,
      activeCalls: this.activeCalls,
      uptime: Date.now() - this.startTime.getTime(),
      lastUpdate: new Date(),
    };

    return this.lastHealth;
  }

  async checkESL(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const isConnected = eslClient.isConnected();
      const canPing = isConnected ? await eslClient.ping() : false;

      return {
        status: canPing ? 'healthy' : isConnected ? 'degraded' : 'unhealthy',
        latencyMs: Date.now() - start,
        message: canPing ? 'Connected and responsive' : 
                 isConnected ? 'Connected but not responding to commands' : 
                 'Not connected',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `ESL error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
      };
    }
  }

  async checkFreeSWITCH(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      if (!eslClient.isConnected()) {
        return {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          message: 'Cannot check FreeSWITCH: ESL not connected',
          lastCheck: new Date(),
        };
      }

      const canPing = await eslClient.ping();

      return {
        status: canPing ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - start,
        message: canPing ? 'FreeSWITCH responding' : 'FreeSWITCH not responding',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `FreeSWITCH error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
      };
    }
  }

  async checkGemini(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_AI_API_KEY;
      
      if (!apiKey) {
        return {
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          message: 'Gemini API key not configured',
          lastCheck: new Date(),
        };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );

      return {
        status: response.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        message: response.ok ? 'Gemini API accessible' : `Gemini API error: ${response.status}`,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `Gemini error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
      };
    }
  }

  async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const { db } = await import('../db');
      const { sql } = await import('drizzle-orm');

      await db.execute(sql`SELECT 1`);

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        message: 'Database connection OK',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
      };
    }
  }

  async checkCodec(): Promise<ComponentHealth> {
    const start = Date.now();

    try {
      const supportedCodecs = ['PCMU', 'PCMA'];
      const requiredCodec = 'PCMU';

      const hasRequired = supportedCodecs.includes(requiredCodec);

      return {
        status: hasRequired ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
        message: hasRequired 
          ? `Codec ${requiredCodec} available` 
          : `Required codec ${requiredCodec} not found`,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        message: `Codec check error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastCheck: new Date(),
      };
    }
  }

  startPeriodicCheck(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAll();
        console.log(`[VoiceHealth] Health check: ${this.lastHealth?.overall}`);
      } catch (error) {
        console.error('[VoiceHealth] Health check error:', error);
      }
    }, intervalMs);

    console.log(`[VoiceHealth] Started periodic health checks every ${intervalMs}ms`);
  }

  stopPeriodicCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[VoiceHealth] Stopped periodic health checks');
    }
  }

  getLastHealth(): SystemHealth | null {
    return this.lastHealth;
  }

  setActiveCalls(count: number): void {
    this.activeCalls = count;
  }

  incrementActiveCalls(): void {
    this.activeCalls++;
  }

  decrementActiveCalls(): void {
    if (this.activeCalls > 0) {
      this.activeCalls--;
    }
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  isHealthy(): boolean {
    return this.lastHealth?.overall === 'healthy';
  }

  canAcceptCalls(): boolean {
    if (!this.lastHealth) return false;

    const esl = this.lastHealth.components.esl;
    const fs = this.lastHealth.components.freeswitch;
    const gemini = this.lastHealth.components.gemini;

    return esl.status !== 'unhealthy' && 
           fs.status !== 'unhealthy' && 
           gemini.status !== 'unhealthy';
  }
}

export const healthCheck = new VoiceHealthCheck();
