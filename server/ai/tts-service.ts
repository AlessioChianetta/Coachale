/**
 * Text-to-Speech Service using Vertex AI Gemini 2.5 Pro TTS
 * Generates audio responses with Achernar voice (Italian female)
 */

import { VertexAI } from "@google-cloud/vertexai";
import { Writer as WavWriter } from "wav";
import { Readable, PassThrough } from "stream";

interface TTSConfig {
  text: string;
  vertexClient: any; // Can be VertexAI or GeminiClient adapter with __vertexAI attached
  projectId: string;
  location: string;
}

/**
 * Convert raw PCM data to WAV format with proper headers
 * 
 * @param pcmData - Raw PCM audio data
 * @returns Promise<Buffer> - Complete WAV file with headers
 */
async function convertPCMtoWAV(pcmData: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    // Create WAV writer with Gemini TTS specifications
    const wavWriter = new WavWriter({
      sampleRate: 24000,     // 24kHz sample rate
      channels: 1,           // Mono
      bitDepth: 16           // 16-bit PCM
    });
    
    // Collect output chunks
    wavWriter.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    // Resolve with complete WAV buffer
    wavWriter.on('finish', () => {
      resolve(Buffer.concat(chunks));
    });
    
    // Handle errors
    wavWriter.on('error', (error: Error) => {
      reject(new Error(`WAV conversion failed: ${error.message}`));
    });
    
    // Write PCM data and end the stream
    wavWriter.end(pcmData);
  });
}

/**
 * Generate speech audio from text using Gemini 2.5 Pro TTS with Achernar voice
 * 
 * @param config - TTS configuration with text, Vertex AI client, and project details
 * @returns Promise<Buffer> - Complete WAV file with proper headers (24kHz, Mono, 16-bit)
 */
export async function generateSpeech({
  text,
  vertexClient,
  projectId,
  location
}: TTSConfig): Promise<Buffer> {
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎙️ [TTS SERVICE] Generating speech with Gemini 2.5 Flash TTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 Text length: ${text.length} characters`);
  console.log(`🗣️ Voice: Achernar (Female, Italian) - Flash Model`);
  console.log(`⚙️ Project: ${projectId}, Location: ${location}`);

  try {
    // Extract VertexAI instance (handle both direct VertexAI and wrapped GeminiClient)
    const vertexAI = vertexClient.__vertexAI || vertexClient;
    
    // Get Gemini 2.5 Flash TTS model
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-2.5-flash-tts'
    });
    
    console.log('🤖 Requesting audio generation...');
    
    // Use standard SSML prosody tags for natural, warm delivery (Gemini TTS respects these)
    // pitch: slightly higher for warmth, rate: medium for clarity
    const styledText = `<speak><prosody pitch="+1st" rate="medium"><emphasis level="moderate">${text}</emphasis></prosody></speak>`;
    
    // Generate audio with Achernar voice configuration
    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: styledText }]
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Achernar'
            }
          }
        }
      }
    });
    
    // Extract audio data from response
    const audioData = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      throw new Error('No audio data received from Gemini TTS');
    }
    
    const pcmBuffer = Buffer.from(audioData, 'base64');
    
    console.log(`✅ Raw PCM audio received`);
    console.log(`   PCM Size: ${pcmBuffer.length} bytes (~${(pcmBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`   Format: 16-bit PCM LINEAR16 @ 24kHz Mono`);
    
    // Convert raw PCM to WAV format with proper headers
    console.log('🔧 Converting PCM to WAV format with headers...');
    const wavBuffer = await convertPCMtoWAV(pcmBuffer);
    
    console.log(`✅ WAV file created successfully`);
    console.log(`   WAV Size: ${wavBuffer.length} bytes (~${(wavBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`   Header added: ${wavBuffer.length - pcmBuffer.length} bytes`);
    console.log(`   Estimated duration: ~${Math.ceil(text.length / 10)} seconds`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return wavBuffer;
    
  } catch (error: any) {
    console.error('❌ [TTS SERVICE] Error generating speech');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    throw new Error(`TTS generation failed: ${error.message}`);
  }
}
