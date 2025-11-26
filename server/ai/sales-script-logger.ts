// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 SALES SCRIPT LOGGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Enhanced console logging for sales agent tracking:
// - Structured logs with Unicode boxes
// - Phase/Checkpoint/Ladder status
// - Full prompt logging (not truncated!)
// - Color-coded severity levels
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class SalesScriptLogger {
  private connectionId: string;
  
  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PHASE TRACKING LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log phase start
   */
  logPhaseStart(phaseId: string, phaseName: string, semanticType: string): void {
    console.log('');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(`║ 🟢 FASE ${phaseId.toUpperCase()} - STARTED${' '.repeat(78 - 28 - phaseId.length)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Nome: ${this.pad(phaseName, 71)} ║`);
    console.log(`║ Tipo Semantico: ${this.pad(semanticType, 60)} ║`);
    console.log(`║ Connection: ${this.pad(this.connectionId, 63)} ║`);
    console.log(`║ Timestamp: ${this.pad(new Date().toISOString(), 64)} ║`);
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
  }
  
  /**
   * Log phase progress
   */
  logPhaseProgress(phaseId: string, stepName: string, questionAsked?: string): void {
    console.log('┌' + '─'.repeat(78) + '┐');
    console.log(`│ 📍 [${phaseId}] Step: ${this.pad(stepName, 78 - 20 - phaseId.length)} │`);
    if (questionAsked) {
      const truncated = questionAsked.length > 70 ? questionAsked.substring(0, 67) + '...' : questionAsked;
      console.log(`│ Question: ${this.pad(truncated, 66)} │`);
    }
    console.log(`│ Time: ${this.pad(new Date().toLocaleTimeString('it-IT'), 69)} │`);
    console.log('└' + '─'.repeat(78) + '┘');
  }
  
  /**
   * Log phase complete
   */
  logPhaseComplete(phaseId: string, phaseName: string, duration: number): void {
    console.log('');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(`║ ✅ FASE ${phaseId.toUpperCase()} - COMPLETED${' '.repeat(78 - 30 - phaseId.length)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Nome: ${this.pad(phaseName, 71)} ║`);
    console.log(`║ Duration: ${this.pad(`${duration} seconds`, 65)} ║`);
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHECKPOINT TRACKING LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log checkpoint start
   */
  logCheckpointStart(checkpointId: string, phaseId: string): void {
    console.log('');
    console.log('┏' + '━'.repeat(78) + '┓');
    console.log(`┃ ⛔ CHECKPOINT ${checkpointId.toUpperCase()} - VERIFICATION PHASE${' '.repeat(78 - 48 - checkpointId.length)} ┃`);
    console.log('┣' + '━'.repeat(78) + '┫');
    console.log(`┃ Phase: ${this.pad(phaseId, 68)} ┃`);
    console.log(`┃ Status: Verifying...${' '.repeat(55)} ┃`);
    console.log('┗' + '━'.repeat(78) + '┛');
  }
  
  /**
   * Log checkpoint progress
   */
  logCheckpointProgress(checkpointId: string, verification: string, completed: boolean): void {
    const icon = completed ? '✓' : '○';
    console.log(`  ${icon} ${verification}`);
  }
  
  /**
   * Log checkpoint complete
   */
  logCheckpointComplete(checkpointId: string, verificationsCount: number): void {
    console.log('');
    console.log('┏' + '━'.repeat(78) + '┓');
    console.log(`┃ ✅ CHECKPOINT ${checkpointId.toUpperCase()} - PASSED${' '.repeat(78 - 38 - checkpointId.length)} ┃`);
    console.log('┣' + '━'.repeat(78) + '┫');
    console.log(`┃ Verifications Completed: ${this.pad(`${verificationsCount}`, 49)} ┃`);
    console.log(`┃ Time: ${this.pad(new Date().toLocaleTimeString('it-IT'), 69)} ┃`);
    console.log('┗' + '━'.repeat(78) + '┛');
    console.log('');
  }
  
  /**
   * Log checkpoint failed
   */
  logCheckpointFailed(checkpointId: string, missingVerifications: string[]): void {
    console.log('');
    console.log('┏' + '━'.repeat(78) + '┓');
    console.log(`┃ ❌ CHECKPOINT ${checkpointId.toUpperCase()} - FAILED${' '.repeat(78 - 37 - checkpointId.length)} ┃`);
    console.log('┣' + '━'.repeat(78) + '┫');
    console.log(`┃ Missing Verifications:${' '.repeat(54)} ┃`);
    missingVerifications.slice(0, 5).forEach(v => {
      const truncated = v.length > 70 ? v.substring(0, 67) + '...' : v;
      console.log(`┃   - ${this.pad(truncated, 72)} ┃`);
    });
    console.log('┗' + '━'.repeat(78) + '┛');
    console.log('');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LADDER TRACKING LOGS (3-5 PERCHÉ)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log ladder activation
   */
  logLadderActivated(level: number, phaseId: string, question: string): void {
    const levelName = this.getLadderLevelName(level);
    
    console.log('');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(`║ 🔍 LADDER ATTIVATO - LIVELLO ${level} (${levelName})${' '.repeat(78 - 40 - levelName.length)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Phase: ${this.pad(phaseId, 68)} ║`);
    console.log(`║ Regola: 3-5 PERCHÉ - SCAVO PROFONDO${' '.repeat(40)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Domanda AI:${' '.repeat(65)} ║`);
    
    // Split question into lines if too long
    const questionLines = this.splitIntoLines(question, 76);
    questionLines.forEach(line => {
      console.log(`║ ${this.pad(line, 76)} ║`);
    });
    
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
  }
  
  /**
   * Log ladder response analysis
   */
  logLadderResponse(wasVague: boolean, shouldContinue: boolean): void {
    if (wasVague && shouldContinue) {
      console.log('⚠️  [LADDER] Risposta VAGA rilevata → Ladder deve CONTINUARE');
      console.log('   AI dovrebbe fare prossima domanda di approfondimento');
    } else if (!wasVague) {
      console.log('✅ [LADDER] Risposta SPECIFICA rilevata → Ladder può FERMARSI');
      console.log('   Pain point identificato con successo!');
    }
  }
  
  /**
   * Get ladder level name
   */
  private getLadderLevelName(level: number): string {
    const names: Record<number, string> = {
      1: 'Chiarificazione',
      2: 'Primo Scavo',
      3: 'Scavo Profondo',
      4: 'Tecnico',
      5: 'Emotivo Finale',
      6: 'Evento Scatenante'
    };
    return names[level] || 'Unknown';
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PROMPT LOGGING (FULL, NOT TRUNCATED!)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log full sales agent prompt (not truncated!)
   */
  logFullPrompt(prompt: string, type: string = 'FULL CONTEXT'): void {
    const charCount = prompt.length;
    const tokenEstimate = Math.ceil(charCount / 4); // Rough estimate
    
    console.log('');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(`║ 📋 SALES AGENT PROMPT - ${type}${' '.repeat(78 - 29 - type.length)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Length: ${this.pad(`${charCount} characters`, 67)} ║`);
    console.log(`║ Tokens (est): ${this.pad(`~${tokenEstimate} tokens`, 62)} ║`);
    console.log(`║ Connection: ${this.pad(this.connectionId, 63)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ FULL PROMPT (NOT TRUNCATED):${' '.repeat(48)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    
    // Split prompt into lines (75 chars max per line for readability)
    const lines = this.splitIntoLines(prompt, 76);
    const maxLinesToShow = 200; // Show first 200 lines in console
    
    lines.slice(0, maxLinesToShow).forEach((line, index) => {
      console.log(`║ ${this.pad(line, 76)} ║`);
    });
    
    if (lines.length > maxLinesToShow) {
      console.log(`║ ... (${lines.length - maxLinesToShow} more lines)${' '.repeat(78 - 30 - String(lines.length - maxLinesToShow).length)} ║`);
      console.log(`║ Full prompt logged above (first ${maxLinesToShow} lines shown)${' '.repeat(78 - 50 - String(maxLinesToShow).length)} ║`);
    }
    
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
  }
  
  /**
   * Log prompt section (minimal, dynamic context, etc)
   */
  logPromptSection(sectionName: string, content: string): void {
    const charCount = content.length;
    
    console.log('');
    console.log('┌' + '─'.repeat(78) + '┐');
    console.log(`│ 📝 PROMPT SECTION: ${this.pad(sectionName, 57)} │`);
    console.log('├' + '─'.repeat(78) + '┤');
    console.log(`│ Length: ${this.pad(`${charCount} chars`, 67)} │`);
    console.log('├' + '─'.repeat(78) + '┤');
    
    // Show first 10 lines
    const lines = this.splitIntoLines(content, 76);
    lines.slice(0, 10).forEach(line => {
      console.log(`│ ${this.pad(line, 76)} │`);
    });
    
    if (lines.length > 10) {
      console.log(`│ ... (${lines.length - 10} more lines)${' '.repeat(78 - 23 - String(lines.length - 10).length)} │`);
    }
    
    console.log('└' + '─'.repeat(78) + '┘');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MESSAGE TRACKING LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log AI message sent
   */
  logAIMessage(message: string, currentPhase: string): void {
    const preview = message.length > 150 ? message.substring(0, 147) + '...' : message;
    const lines = this.splitIntoLines(preview, 76);
    
    console.log('');
    console.log('┌' + '─'.repeat(78) + '┐');
    console.log(`│ 🤖 AI MESSAGE (${currentPhase})${' '.repeat(78 - 20 - currentPhase.length)} │`);
    console.log('├' + '─'.repeat(78) + '┤');
    lines.forEach(line => {
      console.log(`│ ${this.pad(line, 76)} │`);
    });
    console.log(`│ Time: ${this.pad(new Date().toLocaleTimeString('it-IT'), 69)} │`);
    console.log('└' + '─'.repeat(78) + '┘');
  }
  
  /**
   * Log user message received
   */
  logUserMessage(message: string, currentPhase: string): void {
    const preview = message.length > 150 ? message.substring(0, 147) + '...' : message;
    const lines = this.splitIntoLines(preview, 76);
    
    console.log('');
    console.log('┌' + '─'.repeat(78) + '┐');
    console.log(`│ 👤 USER MESSAGE (${currentPhase})${' '.repeat(78 - 21 - currentPhase.length)} │`);
    console.log('├' + '─'.repeat(78) + '┤');
    lines.forEach(line => {
      console.log(`│ ${this.pad(line, 76)} │`);
    });
    console.log(`│ Time: ${this.pad(new Date().toLocaleTimeString('it-IT'), 69)} │`);
    console.log('└' + '─'.repeat(78) + '┘');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUMMARY & STATISTICS LOGS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Log conversation summary
   */
  logConversationSummary(stats: {
    phasesReached: string[];
    checkpointsCompleted: number;
    totalCheckpoints: number;
    ladderActivations: number;
    questionsAsked: number;
    duration: number;
    completionRate: number;
  }): void {
    console.log('');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(`║ 📊 CONVERSATION SUMMARY${' '.repeat(53)} ║`);
    console.log('╠' + '═'.repeat(78) + '╣');
    console.log(`║ Phases Reached: ${this.pad(`${stats.phasesReached.length}`, 59)} ║`);
    console.log(`║   → ${this.pad(stats.phasesReached.join(', '), 72)} ║`);
    console.log(`║ Checkpoints: ${this.pad(`${stats.checkpointsCompleted}/${stats.totalCheckpoints}`, 62)} ║`);
    console.log(`║ Ladder Activations: ${this.pad(`${stats.ladderActivations}`, 55)} ║`);
    console.log(`║ Questions Asked: ${this.pad(`${stats.questionsAsked}`, 58)} ║`);
    console.log(`║ Duration: ${this.pad(`${stats.duration}s`, 65)} ║`);
    console.log(`║ Completion: ${this.pad(`${(stats.completionRate * 100).toFixed(1)}%`, 63)} ║`);
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('');
  }
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UTILITY METHODS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  /**
   * Pad string to specific length
   */
  private pad(str: string, length: number): string {
    if (str.length >= length) {
      return str.substring(0, length);
    }
    return str + ' '.repeat(length - str.length);
  }
  
  /**
   * Split text into lines of max length
   */
  private splitIntoLines(text: string, maxLength: number): string[] {
    const lines: string[] = [];
    const words = text.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
}

/**
 * Create logger instance for a connection
 */
export function createSalesLogger(connectionId: string): SalesScriptLogger {
  return new SalesScriptLogger(connectionId);
}
