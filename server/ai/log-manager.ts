// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 LOG MANAGER - Sistema di Logging Strutturato
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Livelli: ERROR | WARN | INFO | DEBUG
// - ERROR: Errori critici che richiedono attenzione
// - WARN: Avvisi importanti ma non bloccanti
// - INFO: Flusso principale (default)
// - DEBUG: Dettagli verbose (solo se DEBUG_LOGS=true)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

const LOG_ICONS: Record<LogLevel, string> = {
  ERROR: '❌',
  WARN: '⚠️',
  INFO: '📍',
  DEBUG: '🔍'
};

// Controlla se DEBUG mode è attivo
const isDebugMode = (): boolean => {
  return process.env.DEBUG_LOGS === 'true' || process.env.DEBUG === 'true';
};

export class LogManager {
  private prefix: string;
  private connectionId?: string;
  
  constructor(prefix: string, connectionId?: string) {
    this.prefix = prefix;
    this.connectionId = connectionId;
  }
  
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toLocaleTimeString('it-IT');
    const icon = LOG_ICONS[level];
    const connId = this.connectionId ? `[${this.connectionId.substring(0, 8)}]` : '';
    
    let formatted = `${icon} [${level}] ${timestamp} [${this.prefix}]${connId} ${message}`;
    
    if (data && level === 'DEBUG') {
      formatted += `\n   └─ ${JSON.stringify(data, null, 2).split('\n').join('\n      ')}`;
    }
    
    return formatted;
  }
  
  error(message: string, data?: any): void {
    console.error(this.formatMessage('ERROR', message, data));
    if (data && data.stack) {
      console.error(`   └─ Stack: ${data.stack}`);
    }
  }
  
  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', message, data));
  }
  
  info(message: string, data?: any): void {
    console.log(this.formatMessage('INFO', message));
    if (data && isDebugMode()) {
      console.log(`   └─ ${JSON.stringify(data)}`);
    }
  }
  
  debug(message: string, data?: any): void {
    if (isDebugMode()) {
      console.log(this.formatMessage('DEBUG', message, data));
    }
  }
  
  // Log compatto per step/fase (una sola riga)
  step(phase: string, step: string, action: string): void {
    const timestamp = new Date().toLocaleTimeString('it-IT');
    console.log(`📍 ${timestamp} [${this.prefix}] ${phase}/${step} → ${action}`);
  }
  
  // Log per messaggi della conversazione (compatto)
  message(role: 'user' | 'ai', text: string, phase?: string): void {
    const icon = role === 'user' ? '👤' : '🤖';
    const preview = text.length > 100 ? text.substring(0, 97) + '...' : text;
    const phaseInfo = phase ? ` (${phase})` : '';
    console.log(`${icon}${phaseInfo} "${preview}"`);
  }
  
  // Log per risultati STEP-AGENT (compatto)
  stepAgentResult(shouldAdvance: boolean, confidence: number, reasoning: string): void {
    const icon = shouldAdvance ? '✅' : '⏸️';
    const confPercent = Math.round(confidence * 100);
    console.log(`${icon} [STEP-AGENT] advance=${shouldAdvance} (${confPercent}%) - ${reasoning}`);
  }
  
  // Log per correzione sub-agent → agent
  correction(message: string): void {
    console.log(`🔄 [SUBAGENT→AGENT] Correzione: ${message}`);
  }
  
  // Separatore sezione (opzionale, solo in DEBUG)
  section(title: string): void {
    if (isDebugMode()) {
      console.log(`\n━━━ ${title} ━━━`);
    }
  }
}

// Factory per creare logger con prefisso
export function createLogger(prefix: string, connectionId?: string): LogManager {
  return new LogManager(prefix, connectionId);
}

// Logger globale per uso rapido
export const log = {
  error: (prefix: string, message: string, data?: any) => {
    new LogManager(prefix).error(message, data);
  },
  warn: (prefix: string, message: string, data?: any) => {
    new LogManager(prefix).warn(message, data);
  },
  info: (prefix: string, message: string, data?: any) => {
    new LogManager(prefix).info(message, data);
  },
  debug: (prefix: string, message: string, data?: any) => {
    new LogManager(prefix).debug(message, data);
  }
};
