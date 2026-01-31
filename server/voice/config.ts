/**
 * Voice Telephony Configuration
 * RDP Reference: Sezione 5.1
 * 
 * NOTA: Questo codice gira su VPS Hostinger, non su Replit.
 * La connessione ESL è sempre su 127.0.0.1 (localhost) per sicurezza.
 */

export interface VoiceConfig {
  freeswitch: {
    eslHost: string;
    eslPort: number;
    eslPassword: string;
  };
  audio: {
    tempDir: string;
    recordingsDir: string;
    sampleRateIn: number;
    sampleRateOut: number;
  };
  gemini: {
    apiKey: string;
    model: string;
    voiceId: string;
  };
  rateLimits: {
    maxCallsPerMinute: number;
    maxCallsPerHour: number;
    maxCallsPerDay: number;
    maxMinutesPerDay: number;
    blockAnonymous: boolean;
    blockedPrefixes: string[];
  };
  limits: {
    maxConcurrentCalls: number;
    maxCallDurationSeconds: number;
    idleTimeoutSeconds: number;
  };
  database: {
    url: string;
  };
}

function safeLoadConfig(): VoiceConfig {
  return {
    freeswitch: {
      eslHost: process.env.ESL_HOST || '127.0.0.1',
      eslPort: parseInt(process.env.ESL_PORT || '8021', 10),
      eslPassword: process.env.ESL_PASSWORD || '',
    },
    audio: {
      tempDir: process.env.AUDIO_TEMP_DIR || '/dev/shm/alessia',
      recordingsDir: process.env.AUDIO_RECORDINGS_DIR || '/var/lib/alessia/voice_recordings',
      sampleRateIn: 16000,
      sampleRateOut: 24000,
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_AI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-live-2.5-flash-native-audio',
      voiceId: process.env.GEMINI_VOICE_ID || 'Puck',
    },
    rateLimits: {
      maxCallsPerMinute: parseInt(process.env.MAX_CALLS_PER_MINUTE || '3', 10),
      maxCallsPerHour: parseInt(process.env.MAX_CALLS_PER_HOUR || '10', 10),
      maxCallsPerDay: parseInt(process.env.MAX_CALLS_PER_DAY || '30', 10),
      maxMinutesPerDay: parseInt(process.env.MAX_MINUTES_PER_DAY || '60', 10),
      blockAnonymous: process.env.BLOCK_ANONYMOUS !== 'false',
      blockedPrefixes: (process.env.BLOCKED_PREFIXES || '+1900,+44870,+39199,+390899').split(','),
    },
    limits: {
      maxConcurrentCalls: parseInt(process.env.MAX_CONCURRENT_CALLS || '10', 10),
      maxCallDurationSeconds: parseInt(process.env.MAX_CALL_DURATION || '1800', 10),
      idleTimeoutSeconds: parseInt(process.env.IDLE_TIMEOUT || '30', 10),
    },
    database: {
      url: process.env.DATABASE_URL || '',
    },
  };
}

export const voiceConfig = safeLoadConfig();
