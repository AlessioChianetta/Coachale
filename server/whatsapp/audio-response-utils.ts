/**
 * Audio Response Utilities
 * Centralizes logic for determining when to send audio/text responses
 * based on audioResponseMode setting
 */

export type AudioResponseMode = 'always_text' | 'always_audio' | 'mirror' | 'always_both';

export interface AudioResponseDecision {
  sendAudio: boolean;
  sendText: boolean;
}

/**
 * Determines whether to send audio and/or text based on audioResponseMode
 * 
 * @param audioResponseMode - The configured response mode for the agent
 * @param clientSentAudio - Whether the client sent an audio message
 * @returns Object indicating whether to send audio and/or text
 * 
 * @example
 * // Mirror mode: respond with same type as client
 * shouldRespondWithAudio('mirror', true)  // { sendAudio: true, sendText: true }
 * shouldRespondWithAudio('mirror', false) // { sendAudio: false, sendText: true }
 * 
 * // Always audio: send audio regardless of client input
 * shouldRespondWithAudio('always_audio', false) // { sendAudio: true, sendText: false }
 * 
 * // Always both: send both audio and text for maximum accessibility
 * shouldRespondWithAudio('always_both', false) // { sendAudio: true, sendText: true }
 */
export function shouldRespondWithAudio(
  audioResponseMode: AudioResponseMode | null | undefined,
  clientSentAudio: boolean
): AudioResponseDecision {
  
  // Default to text-only if mode is not specified
  if (!audioResponseMode) {
    return { sendAudio: false, sendText: true };
  }

  switch (audioResponseMode) {
    case 'always_text':
      // Always respond with text only
      return { sendAudio: false, sendText: true };
    
    case 'always_audio':
      // Always respond with audio only (no text message sent to client)
      return { sendAudio: true, sendText: false };
    
    case 'mirror':
      // Mirror client's communication style
      // If client sent audio → send audio, otherwise text only
      return { sendAudio: clientSentAudio, sendText: true };
    
    case 'always_both':
      // Send both audio and text for maximum accessibility
      // Client can choose whether to listen or read
      return { sendAudio: true, sendText: true };
    
    default:
      // Fallback to text-only for unknown modes
      console.warn(`[AUDIO] Unknown audioResponseMode: ${audioResponseMode}, defaulting to text`);
      return { sendAudio: false, sendText: true };
  }
}

/**
 * Helper function for backward compatibility
 * Returns true if audio should be generated
 */
export function shouldGenerateAudio(
  audioResponseMode: AudioResponseMode | null | undefined,
  clientSentAudio: boolean
): boolean {
  return shouldRespondWithAudio(audioResponseMode, clientSentAudio).sendAudio;
}
