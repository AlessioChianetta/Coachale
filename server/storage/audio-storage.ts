import fs from "fs/promises";
import path from "path";

/**
 * Audio Storage per Gemini Live Voice
 * 
 * Salva file audio WAV nel filesystem locale
 * Path structure: storage/ai-voice/audio/{userId}/{conversationId}/{messageId}.wav
 */

const AUDIO_STORAGE_PATH = path.join(process.cwd(), "storage", "ai-voice", "audio");

interface AudioUploadResult {
  localPath: string;
  publicUrl: string;
  fileSize: number;
}

/**
 * Salva audio WAV nel filesystem
 * 
 * @param audioBuffer - Buffer contenente l'audio WAV
 * @param userId - ID dell'utente
 * @param conversationId - ID della conversazione
 * @param messageId - ID del messaggio
 * @returns Informazioni sul file salvato
 */
export async function uploadAudio(
  audioBuffer: Buffer,
  userId: string,
  conversationId: string,
  messageId: string
): Promise<AudioUploadResult> {
  try {
    // Crea path con struttura organizzata
    const userDir = path.join(AUDIO_STORAGE_PATH, userId, conversationId);
    const fileName = `${messageId}.wav`;
    const localPath = path.join(userDir, fileName);

    // Crea directory se non esiste (ricorsivamente)
    await fs.mkdir(userDir, { recursive: true });

    // Salva file
    await fs.writeFile(localPath, audioBuffer);

    const fileSize = audioBuffer.length;

    // Genera URL pubblico per accesso via HTTP
    const publicUrl = `/uploads/ai-voice/${userId}/${conversationId}/${fileName}`;

    console.log(`✅ Audio saved: ${publicUrl} (${(fileSize / 1024).toFixed(2)} KB)`);

    return {
      localPath,
      publicUrl,
      fileSize,
    };
  } catch (error) {
    console.error("❌ Error uploading audio:", error);
    throw new Error(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Ottieni URL pubblico per audio esistente
 * 
 * @param userId - ID dell'utente
 * @param conversationId - ID della conversazione
 * @param messageId - ID del messaggio
 * @returns URL pubblico o null se file non esiste
 */
export async function getAudioURL(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<string | null> {
  try {
    const fileName = `${messageId}.wav`;
    const localPath = path.join(AUDIO_STORAGE_PATH, userId, conversationId, fileName);

    // Verifica che il file esista
    await fs.access(localPath);

    return `/uploads/ai-voice/${userId}/${conversationId}/${fileName}`;
  } catch (error) {
    console.warn(`⚠️ Audio file not found: ${userId}/${conversationId}/${messageId}`);
    return null;
  }
}

/**
 * Elimina file audio dal filesystem
 * 
 * @param userId - ID dell'utente
 * @param conversationId - ID della conversazione
 * @param messageId - ID del messaggio
 * @returns True se eliminato con successo
 */
export async function deleteAudio(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<boolean> {
  try {
    const fileName = `${messageId}.wav`;
    const localPath = path.join(AUDIO_STORAGE_PATH, userId, conversationId, fileName);

    await fs.unlink(localPath);

    console.log(`🗑️ Audio deleted: ${userId}/${conversationId}/${messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting audio: ${error}`);
    return false;
  }
}

/**
 * Elimina tutti gli audio di una conversazione
 * 
 * @param userId - ID dell'utente
 * @param conversationId - ID della conversazione
 * @returns Numero di file eliminati
 */
export async function deleteConversationAudios(
  userId: string,
  conversationId: string
): Promise<number> {
  try {
    const conversationDir = path.join(AUDIO_STORAGE_PATH, userId, conversationId);
    
    // Leggi tutti i file nella directory
    const files = await fs.readdir(conversationDir);
    
    // Elimina ogni file
    for (const file of files) {
      await fs.unlink(path.join(conversationDir, file));
    }

    // Rimuovi directory vuota
    await fs.rmdir(conversationDir);

    console.log(`🗑️ Deleted ${files.length} audio files from conversation ${conversationId}`);
    return files.length;
  } catch (error) {
    console.error(`❌ Error deleting conversation audios: ${error}`);
    return 0;
  }
}

/**
 * Ottieni dimensione totale audio di un utente (in bytes)
 * 
 * @param userId - ID dell'utente
 * @returns Dimensione totale in bytes
 */
export async function getUserAudioStorageSize(userId: string): Promise<number> {
  try {
    const userDir = path.join(AUDIO_STORAGE_PATH, userId);
    
    let totalSize = 0;

    async function calculateSize(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }

    await calculateSize(userDir);
    
    return totalSize;
  } catch (error) {
    console.warn(`⚠️ Error calculating storage size for user ${userId}: ${error}`);
    return 0;
  }
}

/**
 * Converte Base64 string in Buffer
 * Utility per salvare audio ricevuto dal WebSocket
 */
export function base64ToBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Converte Buffer in Base64 string
 * Utility per inviare audio via WebSocket
 */
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}
