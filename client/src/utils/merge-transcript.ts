// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔀 TRANSCRIPT MESSAGE MERGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Merges consecutive messages from the same speaker within a time window
// Solves the VAD chunking problem where a single phrase is split into multiple messages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  duration?: number;
}

export interface MergeOptions {
  maxTimeGapSeconds?: number;  // Max time gap between messages to merge (default: 2 seconds)
  mergeAllSameSpeaker?: boolean; // Merge all consecutive messages from same speaker regardless of time (default: false)
}

/**
 * Merge consecutive messages from the same speaker within a time window
 * 
 * This solves the VAD (Voice Activity Detection) chunking problem where Gemini Live
 * sends multiple `turnComplete` events for a single phrase, creating fragmented transcript.
 * 
 * Example:
 * Before merge:
 *   [assistant, 10:00:00] "Ciao, come stai?"
 *   [assistant, 10:00:01] "Ti sento bene oggi!"
 *   [user, 10:00:05] "Sì, tutto ok grazie"
 * 
 * After merge (2s window):
 *   [assistant, 10:00:00] "Ciao, come stai? Ti sento bene oggi!"
 *   [user, 10:00:05] "Sì, tutto ok grazie"
 * 
 * @param messages - Array of transcript messages to merge
 * @param options - Merge options (maxTimeGapSeconds, mergeAllSameSpeaker)
 * @returns Merged array of messages
 */
export function mergeConsecutiveMessages(
  messages: TranscriptMessage[],
  options: MergeOptions = {}
): TranscriptMessage[] {
  const { maxTimeGapSeconds = 2, mergeAllSameSpeaker = false } = options;
  
  if (messages.length === 0) return [];
  
  const merged: TranscriptMessage[] = [];
  let currentGroup: TranscriptMessage | null = null;
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // First message or different speaker - start new group
    if (!currentGroup || msg.role !== currentGroup.role) {
      if (currentGroup) {
        merged.push(currentGroup);
      }
      currentGroup = { ...msg };
      continue;
    }
    
    // Same speaker - check if we should merge
    const currentTime = new Date(msg.timestamp).getTime();
    const groupTime = new Date(currentGroup.timestamp).getTime();
    const timeGapSeconds = (currentTime - groupTime) / 1000;
    
    const shouldMerge = mergeAllSameSpeaker || timeGapSeconds <= maxTimeGapSeconds;
    
    if (shouldMerge) {
      // Merge: combine content, keep earliest timestamp, sum durations
      currentGroup.content += ' ' + msg.content;
      if (msg.duration && currentGroup.duration) {
        currentGroup.duration += msg.duration;
      }
    } else {
      // Time gap too large - start new group
      merged.push(currentGroup);
      currentGroup = { ...msg };
    }
  }
  
  // Push last group
  if (currentGroup) {
    merged.push(currentGroup);
  }
  
  return merged;
}

/**
 * Get merge statistics for debugging
 */
export function getMergeStats(
  original: TranscriptMessage[],
  merged: TranscriptMessage[]
): {
  originalCount: number;
  mergedCount: number;
  messagesSaved: number;
  mergeRatio: number;
} {
  const messagesSaved = original.length - merged.length;
  const mergeRatio = original.length > 0 ? (messagesSaved / original.length) * 100 : 0;
  
  return {
    originalCount: original.length,
    mergedCount: merged.length,
    messagesSaved,
    mergeRatio: Math.round(mergeRatio * 10) / 10, // 1 decimal place
  };
}
