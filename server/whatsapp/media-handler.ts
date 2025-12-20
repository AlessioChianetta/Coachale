import axios from "axios";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { VertexAI } from "@google-cloud/vertexai";
import { GEMINI_3_MODEL, GEMINI_LEGACY_MODEL } from "../ai/provider-factory";
import { PDFParse } from "pdf-parse";
import { db } from "../db";
import { whatsappMessages, whatsappMediaFiles, consultantWhatsappConfig } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

const STORAGE_PATH = path.join(process.cwd(), "storage", "whatsapp", "media");

/**
 * Vertex AI credentials for media processing
 */
export interface VertexAICredentials {
  projectId: string;
  location: string;
  credentials: any;
}

interface MediaDownloadResult {
  localPath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface MediaProcessingResult {
  aiAnalysis?: string;
  extractedText?: string;
  audioDuration?: number;
  audioTranscript?: string;
}

/**
 * Download media file from Twilio URL and save locally
 */
export async function downloadMedia(
  mediaUrl: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  messageId: string
): Promise<MediaDownloadResult> {
  const downloadStart = Date.now();
  try {
    console.log(`📥 Downloading media from: ${mediaUrl}`);

    const response = await axios.get(mediaUrl, {
      auth: {
        username: twilioAccountSid,
        password: twilioAuthToken,
      },
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "application/octet-stream";
    const extension = getExtensionFromMimeType(contentType);
    const fileName = `${messageId}_${Date.now()}${extension}`;
    const localPath = path.join(STORAGE_PATH, fileName);

    await fs.mkdir(STORAGE_PATH, { recursive: true });
    await fs.writeFile(localPath, response.data);

    const fileSize = response.data.length;
    const downloadTime = ((Date.now() - downloadStart) / 1000).toFixed(1);

    console.log(`✅ Media saved: ${fileName} (${(fileSize / 1024).toFixed(2)} KB)`);
    console.log(`⏱️ [TIMING] Download: ${downloadTime}s`);

    return {
      localPath,
      fileName,
      fileSize,
      mimeType: contentType,
    };
  } catch (error) {
    const downloadTime = ((Date.now() - downloadStart) / 1000).toFixed(1);
    console.error(`❌ Error downloading media (after ${downloadTime}s):`, error);
    throw error;
  }
}

/**
 * Process media file with AI analysis based on type
 * Supports Vertex AI for audio transcription when credentials are provided
 */
export async function processMedia(
  localPath: string,
  mimeType: string,
  apiKey: string,
  vertexCredentials?: VertexAICredentials
): Promise<MediaProcessingResult> {
  const result: MediaProcessingResult = {};

  try {
    if (mimeType.startsWith("image/")) {
      console.log("🖼️ Processing image with AI Vision...");
      result.aiAnalysis = await processImageWithVision(localPath, apiKey, mimeType);
      result.extractedText = await extractTextFromImage(localPath);
    } else if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
      console.log("📄 Processing PDF document...");
      result.extractedText = await extractTextFromPDF(localPath);
      result.aiAnalysis = await analyzeDocumentText(result.extractedText, apiKey);
    } else if (mimeType.startsWith("audio/")) {
      console.log("🎤 Processing audio file...");
      const audioResult = await transcribeAudio(localPath, apiKey, mimeType, vertexCredentials);
      result.audioTranscript = audioResult.transcript;
      result.audioDuration = audioResult.duration;
    } else {
      console.log(`ℹ️ Unsupported media type for AI processing: ${mimeType}`);
    }

    return result;
  } catch (error) {
    console.error("❌ Error processing media:", error);
    return result;
  }
}

/**
 * Analyze image using Gemini Vision API
 */
async function processImageWithVision(
  imagePath: string,
  apiKey: string,
  mimeType: string
): Promise<string> {
  try {
    let imageBuffer = await fs.readFile(imagePath);
    let finalMimeType = mimeType;

    // Convert all images to JPEG for consistent Gemini processing
    if (mimeType.startsWith("image/")) {
      try {
        imageBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 85 })
          .toBuffer();
        finalMimeType = "image/jpeg";
        console.log(`🔄 Converted ${mimeType} to image/jpeg for Vision API`);
      } catch (conversionError) {
        console.warn("⚠️ Image conversion failed, using original format:", conversionError);
      }
    }

    const base64Image = imageBuffer.toString("base64");
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analizza questa immagine in dettaglio. Descrivi:
1. Cosa vedi nell'immagine
2. Se c'è cibo: stima delle calorie e macronutrienti
3. Se sono esercizi fisici: tipo di esercizio, forma, suggerimenti
4. Se sono documenti/screenshot: estrai e riassumi il contenuto
5. Qualsiasi altro dettaglio rilevante

Rispondi in italiano, sii specifico e conciso.`,
            },
            {
              inlineData: {
                mimeType: finalMimeType,
                data: base64Image,
              },
            },
          ],
        },
      ],
    });

    const analysis = response.text || "Impossibile analizzare l'immagine.";
    console.log(`✅ AI Vision analysis complete (${analysis.length} chars)`);
    return analysis;
  } catch (error) {
    console.error("❌ Error in AI Vision:", error);
    return "Errore durante l'analisi dell'immagine.";
  }
}

/**
 * Extract text from image using OCR (via sharp metadata)
 * Note: For proper OCR, consider using Tesseract.js or Google Vision API in the future
 */
async function extractTextFromImage(imagePath: string): Promise<string | undefined> {
  try {
    const metadata = await sharp(imagePath).metadata();
    return metadata.exif?.toString() || undefined;
  } catch (error) {
    console.error("❌ Error extracting text from image:", error);
    return undefined;
  }
}

/**
 * Extract text from PDF document
 * Uses pdf-parse v2.x API with PDFParse class
 */
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    
    // Use PDFParse class (v2.x API)
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    const text = result.text.trim();
    console.log(`✅ Extracted ${text.length} characters from PDF`);
    return text;
  } catch (error) {
    console.error("❌ Error parsing PDF:", error);
    return "Impossibile estrarre testo dal PDF.";
  }
}

/**
 * Analyze document text with AI
 */
async function analyzeDocumentText(text: string, apiKey: string): Promise<string> {
  if (!text || text.length < 50) {
    return "Documento troppo breve per analisi.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_3_MODEL,
      config: {
        systemInstruction: `Sei un assistente AI specializzato in analisi documenti.
Analizza il testo fornito e identifica:
1. Tipo di documento (fattura, estratto conto, contratto, etc)
2. Informazioni chiave (importi, date, nomi)
3. Riassunto del contenuto
4. Eventuali azioni richieste

Rispondi in italiano, sii conciso e strutturato.`,
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Analizza questo documento:\n\n${text.substring(0, 4000)}`,
            },
          ],
        },
      ],
    });

    const analysis = response.text || "Impossibile analizzare il documento.";
    console.log(`✅ Document analysis complete (${analysis.length} chars)`);
    return analysis;
  } catch (error) {
    console.error("❌ Error analyzing document:", error);
    return "Errore durante l'analisi del documento.";
  }
}

/**
 * Transcribe audio file using Vertex AI or Google AI Studio with retry logic
 * Prefers Vertex AI when credentials are available
 * Includes automatic retry for 503/429 errors with exponential backoff
 */
async function transcribeAudio(
  audioPath: string,
  apiKey: string,
  mimeType: string,
  vertexCredentials?: VertexAICredentials
): Promise<{ transcript: string; duration?: number }> {
  const transcriptionStart = Date.now();
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  const fileReadStart = Date.now();
  const audioBuffer = await fs.readFile(audioPath);
  const base64Audio = audioBuffer.toString("base64");
  const fileReadTime = ((Date.now() - fileReadStart) / 1000).toFixed(1);
  console.log(`⏱️ [TIMING] Audio file read + base64: ${fileReadTime}s (${(audioBuffer.length / 1024).toFixed(1)} KB)`);

  // Map common audio MIME types to Gemini-supported formats
  let finalMimeType = mimeType;
  
  // Normalize MIME types for Gemini compatibility
  if (mimeType.includes("opus") || mimeType === "audio/ogg; codecs=opus") {
    finalMimeType = "audio/ogg";
  } else if (mimeType === "audio/webm") {
    finalMimeType = "audio/ogg";
  } else if (!["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"].includes(mimeType)) {
    console.warn(`⚠️ Unsupported audio format: ${mimeType}, trying as audio/ogg`);
    finalMimeType = "audio/ogg";
  }

  const useVertexAI = !!vertexCredentials;
  console.log(`🎵 Transcribing audio with ${useVertexAI ? 'Vertex AI' : 'Google AI Studio'} (MIME: ${finalMimeType})`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const apiCallStart = Date.now();
    try {
      let transcript: string;

      if (useVertexAI && vertexCredentials) {
        // Use Vertex AI
        const vertexAI = new VertexAI({
          project: vertexCredentials.projectId,
          location: vertexCredentials.location,
          googleAuthOptions: {
            credentials: vertexCredentials.credentials,
          },
        });

        const model = vertexAI.preview.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Trascrivi questo messaggio audio in italiano. Fornisci solo la trascrizione, senza commenti aggiuntivi.",
                },
                {
                  inlineData: {
                    mimeType: finalMimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        });

        // Extract text from Vertex AI response
        const candidate = result.response?.candidates?.[0];
        transcript = candidate?.content?.parts?.[0]?.text || "Impossibile trascrivere l'audio.";
      } else {
        // Fallback to Google AI Studio
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
          model: GEMINI_3_MODEL,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: "Trascrivi questo messaggio audio in italiano. Fornisci solo la trascrizione, senza commenti aggiuntivi.",
                },
                {
                  inlineData: {
                    mimeType: finalMimeType,
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        });

        transcript = response.text || "Impossibile trascrivere l'audio.";
      }

      const apiCallTime = ((Date.now() - apiCallStart) / 1000).toFixed(1);
      const totalTranscriptionTime = ((Date.now() - transcriptionStart) / 1000).toFixed(1);
      console.log(`⏱️ [TIMING] Transcription API: ${apiCallTime}s`);
      console.log(`⏱️ [TIMING] Total transcription: ${totalTranscriptionTime}s`);
      console.log(`✅ Audio transcribed via ${useVertexAI ? 'Vertex AI' : 'Google AI Studio'} (${transcript.length} chars)`);

      return {
        transcript,
        duration: undefined,
      };
    } catch (error: any) {
      const status = error?.status || error?.response?.status || error?.code;
      const isRetryable = status === 503 || status === 429 || status === 500 || status === 'UNAVAILABLE';
      
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Transcription attempt ${attempt}/${MAX_RETRIES} failed (status: ${status}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      console.error(`❌ Error transcribing audio (attempt ${attempt}/${MAX_RETRIES}):`, error);
      return {
        transcript: "Errore durante la trascrizione dell'audio.",
      };
    }
  }

  return {
    transcript: "Errore durante la trascrizione dell'audio.",
  };
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "audio/webm": ".webm",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };

  return mimeMap[mimeType] || ".bin";
}

/**
 * Main entry point: Download and process media from Twilio message
 * Handles both remote Twilio URLs and local file paths (e.g., from simulators)
 * Supports Vertex AI for audio transcription when credentials are provided
 */
export async function handleIncomingMedia(
  messageId: string,
  mediaUrl: string,
  mediaContentType: string,
  consultantId: string,
  apiKey: string,
  configId?: string,
  vertexCredentials?: VertexAICredentials
): Promise<void> {
  const mediaProcessingStart = Date.now();
  try {
    console.log(`📱 Processing media for message ${messageId} (type: ${mediaContentType})`);

    // Check if mediaUrl is a local file path (from simulator) or remote URL (from Twilio)
    const isLocalFile = !mediaUrl.startsWith('http://') && !mediaUrl.startsWith('https://');
    
    let downloadResult: MediaDownloadResult;

    if (isLocalFile) {
      // Media is already local (from simulator) - skip download
      console.log(`📂 [LOCAL FILE] Media is already local: ${mediaUrl}`);
      
      // Get file stats
      const stats = await fs.stat(mediaUrl);
      const fileName = path.basename(mediaUrl);
      
      downloadResult = {
        localPath: mediaUrl,
        fileName: fileName,
        fileSize: stats.size,
        mimeType: mediaContentType
      };
      
      console.log(`✅ Local file ready: ${fileName} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      // Media is remote (from Twilio) - download it
      console.log(`🌐 [REMOTE URL] Downloading from Twilio: ${mediaUrl}`);
      
      // Use specific agent config if provided, otherwise find by consultantId with valid credentials
      let config;
      if (configId) {
        [config] = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(eq(consultantWhatsappConfig.id, configId))
          .limit(1);
      } else {
        // Fallback: find agent with valid Twilio credentials for this consultant
        [config] = await db
          .select()
          .from(consultantWhatsappConfig)
          .where(
            and(
              eq(consultantWhatsappConfig.consultantId, consultantId),
              sql`${consultantWhatsappConfig.twilioAccountSid} IS NOT NULL`,
              sql`${consultantWhatsappConfig.twilioAuthToken} IS NOT NULL`,
              sql`${consultantWhatsappConfig.integrationMode} = 'whatsapp_ai'`
            )
          )
          .limit(1);
      }

      if (!config) {
        console.error("❌ No Twilio config found for consultant/agent");
        return;
      }
      
      if (!config.twilioAccountSid || !config.twilioAuthToken) {
        console.error(`❌ Agent ${config.agentName} has no valid Twilio credentials`);
        return;
      }

      console.log(`🔑 Using credentials from agent: ${config.agentName}`);

      downloadResult = await downloadMedia(
        mediaUrl,
        config.twilioAccountSid,
        config.twilioAuthToken,
        messageId
      );
    }

    const processingResult = await processMedia(
      downloadResult.localPath,
      downloadResult.mimeType,
      apiKey,
      vertexCredentials
    );

    // Save to whatsapp_media_files table
    await db.insert(whatsappMediaFiles).values({
      messageId,
      originalUrl: mediaUrl,
      localPath: downloadResult.localPath,
      fileName: downloadResult.fileName,
      fileSize: downloadResult.fileSize,
      mimeType: downloadResult.mimeType,
      downloaded: true,
      downloadedAt: new Date(),
      aiProcessed: !!processingResult.aiAnalysis,
      aiAnalysis: processingResult.aiAnalysis || null,
      extractedText: processingResult.extractedText || null,
    });

    // Also update message with metadata for backward compatibility
    await db
      .update(whatsappMessages)
      .set({
        localMediaPath: downloadResult.localPath,
        mediaSize: downloadResult.fileSize,
        mediaContentType: downloadResult.mimeType,
        metadata: {
          aiVisionAnalysis: processingResult.aiAnalysis,
          extractedText: processingResult.extractedText,
          audioDuration: processingResult.audioDuration,
          audioTranscript: processingResult.audioTranscript,
        },
      })
      .where(eq(whatsappMessages.id, messageId));

    const totalMediaTime = ((Date.now() - mediaProcessingStart) / 1000).toFixed(1);
    console.log(`⏱️ [TIMING] Total media processing: ${totalMediaTime}s`);
    console.log(`✅ Media processing complete for message ${messageId}`);
  } catch (error) {
    const totalMediaTime = ((Date.now() - mediaProcessingStart) / 1000).toFixed(1);
    console.error(`❌ Error in handleIncomingMedia (after ${totalMediaTime}s):`, error);
  }
}
