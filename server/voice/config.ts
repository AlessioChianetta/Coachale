/**
 * Voice Telephony Configuration
 * RDP Reference: Sezione 5.1
 * 
 * NOTA: Questo codice gira su VPS Hostinger, non su Replit.
 * La connessione ESL è sempre su 127.0.0.1 (localhost) per sicurezza.
 */

export interface VoiceConfig {
  esl: {
    host: string;
    port: number;
    password: string;
  };
  audio: {
    tempDir: string;
    recordingsDir: string;
    sampleRate: number;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  rateLimits: {
    maxCallsPerMinute: number;
    maxCallsPerHour: number;
    maxCallsPerDay: number;
    maxMinutesPerDay: number;
    blockAnonymous: boolean;
    blockedPrefixes: string[];
  };
  database: {
    url: string;
  };
}

export function loadConfig(): VoiceConfig {
  const requiredEnvVars = [
    'ESL_PASSWORD',
    'GEMINI_API_KEY',
    'DATABASE_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    esl: {
      host: process.env.ESL_HOST || '127.0.0.1',
      port: parseInt(process.env.ESL_PORT || '8021', 10),
      password: process.env.ESL_PASSWORD!,
    },
    audio: {
      tempDir: process.env.AUDIO_TEMP_DIR || '/dev/shm/alessia',
      recordingsDir: process.env.AUDIO_RECORDINGS_DIR || '/var/lib/alessia/voice_recordings',
      sampleRate: 8000,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY!,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    },
    rateLimits: {
      maxCallsPerMinute: parseInt(process.env.MAX_CALLS_PER_MINUTE || '3', 10),
      maxCallsPerHour: parseInt(process.env.MAX_CALLS_PER_HOUR || '10', 10),
      maxCallsPerDay: parseInt(process.env.MAX_CALLS_PER_DAY || '30', 10),
      maxMinutesPerDay: parseInt(process.env.MAX_MINUTES_PER_DAY || '60', 10),
      blockAnonymous: process.env.BLOCK_ANONYMOUS !== 'false',
      blockedPrefixes: (process.env.BLOCKED_PREFIXES || '+1900,+44870,+39199,+390899').split(','),
    },
    database: {
      url: process.env.DATABASE_URL!,
    },
  };
}

export const config = loadConfig();
