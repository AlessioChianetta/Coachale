import { EventEmitter } from 'events';
import { db } from '../db';
import { voiceCalls, voiceCallEvents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { eslClient } from './voice-esl-client';
import { audioHandler } from './voice-audio-handler';
import { rateLimiter } from './voice-rate-limiter';
import { callerLookup } from './voice-caller-lookup';
import { createGeminiBridge, VoiceGeminiBridge } from './voice-gemini-bridge';
import { healthCheck } from './voice-health';
import { voiceConfig } from './config';

type CallState = 'ringing' | 'answering' | 'greeting' | 'listening' | 'processing' | 'speaking' | 'transferring' | 'ending' | 'ended';

interface ActiveCall {
  id: string;
  uuid: string;
  callerId: string;
  calledNumber: string;
  voiceNumberId: string;
  consultantId: string;
  state: CallState;
  startTime: Date;
  answerTime: Date | null;
  endTime: Date | null;
  callerInfo: any;
  userContext: any;
  geminiBridge: VoiceGeminiBridge | null;
  transcript: string[];
  events: Array<{ type: string; timestamp: Date; data?: any }>;
  recordingPath: string | null;
  lastActivityTime: Date;
}

export class VoiceCallManager extends EventEmitter {
  private activeCalls: Map<string, ActiveCall> = new Map();
  private uuidToCallId: Map<string, string> = new Map();
  private maxConcurrentCalls: number;
  private callTimeout: number;
  private idleTimeout: number;

  constructor() {
    super();
    this.maxConcurrentCalls = voiceConfig.limits.maxConcurrentCalls;
    this.callTimeout = voiceConfig.limits.maxCallDurationSeconds * 1000;
    this.idleTimeout = voiceConfig.limits.idleTimeoutSeconds * 1000;

    this.setupESLHandlers();
    this.startTimeoutChecker();
  }

  private setupESLHandlers(): void {
    eslClient.onChannelCreate(async (event) => {
      const uuid = event.getHeader('Unique-ID');
      const callerId = event.getHeader('Caller-Caller-ID-Number') || 'unknown';
      const calledNumber = event.getHeader('Caller-Destination-Number') || '';

      console.log(`[CallManager] New call: ${uuid} from ${callerId} to ${calledNumber}`);

      await this.handleNewCall(uuid, callerId, calledNumber);
    });

    eslClient.onChannelAnswer(async (event) => {
      const uuid = event.getHeader('Unique-ID');
      const callId = this.uuidToCallId.get(uuid);

      if (callId) {
        await this.handleCallAnswered(callId);
      }
    });

    eslClient.onChannelHangup(async (event) => {
      const uuid = event.getHeader('Unique-ID');
      const callId = this.uuidToCallId.get(uuid);
      const cause = event.getHeader('Hangup-Cause') || 'NORMAL_CLEARING';

      if (callId) {
        await this.handleCallEnded(callId, cause);
      }
    });

    eslClient.onDTMF((event) => {
      const uuid = event.getHeader('Unique-ID');
      const digit = event.getHeader('DTMF-Digit');
      const callId = this.uuidToCallId.get(uuid);

      if (callId && digit) {
        this.handleDTMF(callId, digit);
      }
    });
  }

  private async handleNewCall(uuid: string, callerId: string, calledNumber: string): Promise<void> {
    if (!healthCheck.canAcceptCalls()) {
      console.warn('[CallManager] System not ready, rejecting call');
      await eslClient.hangup(uuid, 'NORMAL_TEMPORARY_FAILURE');
      return;
    }

    if (this.activeCalls.size >= this.maxConcurrentCalls) {
      console.warn('[CallManager] Max concurrent calls reached, rejecting');
      await eslClient.hangup(uuid, 'CALL_REJECTED');
      return;
    }

    const voiceNumber = await this.findVoiceNumber(calledNumber);
    if (!voiceNumber) {
      console.error(`[CallManager] Voice number not found: ${calledNumber}`);
      await eslClient.hangup(uuid, 'UNALLOCATED_NUMBER');
      return;
    }

    const rateCheck = await rateLimiter.checkRateLimit(callerId, voiceNumber.id);
    if (!rateCheck.allowed) {
      console.warn(`[CallManager] Rate limit: ${rateCheck.reason}`);
      await eslClient.hangup(uuid, 'CALL_REJECTED');
      return;
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const call: ActiveCall = {
      id: callId,
      uuid,
      callerId,
      calledNumber,
      voiceNumberId: voiceNumber.id,
      consultantId: voiceNumber.consultantId,
      state: 'ringing',
      startTime: new Date(),
      answerTime: null,
      endTime: null,
      callerInfo: null,
      userContext: null,
      geminiBridge: null,
      transcript: [],
      events: [{ type: 'CALL_START', timestamp: new Date() }],
      recordingPath: null,
      lastActivityTime: new Date(),
    };

    this.activeCalls.set(callId, call);
    this.uuidToCallId.set(uuid, callId);
    healthCheck.incrementActiveCalls();

    await this.saveCallToDatabase(call);

    await eslClient.answer(uuid);
    this.updateCallState(callId, 'answering');
  }

  private async handleCallAnswered(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.answerTime = new Date();
    this.addEvent(callId, 'CALL_ANSWER');

    const context = await callerLookup.lookupCaller(call.callerId, call.voiceNumberId);
    if (context) {
      call.callerInfo = context.callerInfo;
      call.userContext = context.userContext;

      this.addEvent(callId, 'CALLER_IDENTIFIED', {
        recognized: context.callerInfo.isRecognized,
        isClient: context.callerInfo.isClient,
      });
    }

    this.updateCallState(callId, 'greeting');

    const bridge = createGeminiBridge();
    call.geminiBridge = bridge;

    bridge.on('audio', (audioData: Buffer) => {
      this.handleGeminiAudio(callId, audioData);
    });

    bridge.on('text', (text: string) => {
      call.transcript.push(`[AI] ${text}`);
    });

    bridge.on('turnComplete', () => {
      this.updateCallState(callId, 'listening');
    });

    bridge.on('error', (error: Error) => {
      console.error(`[CallManager] Gemini error on call ${callId}:`, error);
      this.addEvent(callId, 'AI_ERROR', { message: error.message });
    });

    try {
      await bridge.initialize({
        callerInfo: call.callerInfo,
        userContext: call.userContext,
        greeting: context?.greeting || 'Buongiorno, sono Alessia. Come posso aiutarti?',
        consultantId: call.consultantId,
      });

      await bridge.playGreeting();
      this.updateCallState(callId, 'speaking');
    } catch (error) {
      console.error(`[CallManager] Failed to initialize AI for call ${callId}:`, error);
      this.addEvent(callId, 'AI_INIT_FAILED', { error: String(error) });
      await this.endCall(callId, 'AI_FAILURE');
    }
  }

  private async handleCallEnded(callId: string, cause: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.endTime = new Date();
    this.updateCallState(callId, 'ended');
    this.addEvent(callId, 'CALL_END', { cause });

    if (call.geminiBridge) {
      await call.geminiBridge.close();
    }

    await this.updateCallInDatabase(call, cause);

    this.activeCalls.delete(callId);
    this.uuidToCallId.delete(call.uuid);
    healthCheck.decrementActiveCalls();

    this.emit('callEnded', {
      callId,
      duration: call.answerTime 
        ? (call.endTime.getTime() - call.answerTime.getTime()) / 1000 
        : 0,
      cause,
    });

    console.log(`[CallManager] Call ${callId} ended: ${cause}`);
  }

  private handleDTMF(callId: string, digit: string): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.lastActivityTime = new Date();
    this.addEvent(callId, 'DTMF', { digit });

    if (digit === '0') {
      this.transferToOperator(callId);
    }
  }

  private async handleGeminiAudio(callId: string, audioData: Buffer): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call || call.state === 'ended') return;

    try {
      const filePath = await audioHandler.processOutgoingAudio(audioData);
      await eslClient.broadcast(call.uuid, filePath, 'aleg');
    } catch (error) {
      console.error(`[CallManager] Error playing audio for call ${callId}:`, error);
    }
  }

  async sendAudioToAI(callId: string, audioData: Buffer): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call || !call.geminiBridge || call.state === 'ended') return;

    call.lastActivityTime = new Date();

    if (call.state === 'speaking') {
      await call.geminiBridge.interrupt();
    }

    this.updateCallState(callId, 'processing');
    await call.geminiBridge.sendAudio(audioData);
  }

  private async transferToOperator(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    this.updateCallState(callId, 'transferring');
    this.addEvent(callId, 'TRANSFER_REQUESTED');

    console.log(`[CallManager] Transfer requested for call ${callId}`);
  }

  async endCall(callId: string, reason: string = 'NORMAL_CLEARING'): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    this.updateCallState(callId, 'ending');

    try {
      await eslClient.hangup(call.uuid, reason);
    } catch (error) {
      console.error(`[CallManager] Error hanging up call ${callId}:`, error);
    }
  }

  private updateCallState(callId: string, newState: CallState): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const oldState = call.state;
    call.state = newState;

    this.addEvent(callId, 'STATE_CHANGE', { from: oldState, to: newState });
    this.emit('stateChange', { callId, oldState, newState });
  }

  private addEvent(callId: string, type: string, data?: any): void {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    call.events.push({
      type,
      timestamp: new Date(),
      data,
    });
  }

  private async findVoiceNumber(phoneNumber: string) {
    const { voiceNumbers } = await import('@shared/schema');
    
    const result = await db
      .select()
      .from(voiceNumbers)
      .where(eq(voiceNumbers.phoneNumber, phoneNumber))
      .limit(1);

    return result[0] || null;
  }

  private async saveCallToDatabase(call: ActiveCall): Promise<void> {
    try {
      await db.insert(voiceCalls).values({
        id: call.id,
        consultantId: call.consultantId,
        voiceNumberId: call.voiceNumberId,
        callerId: call.callerId,
        calledNumber: call.calledNumber,
        direction: 'inbound',
        status: 'ringing',
        startedAt: call.startTime,
      });
    } catch (error) {
      console.error(`[CallManager] Error saving call to database:`, error);
    }
  }

  private async updateCallInDatabase(call: ActiveCall, endCause: string): Promise<void> {
    try {
      const duration = call.answerTime && call.endTime
        ? Math.round((call.endTime.getTime() - call.answerTime.getTime()) / 1000)
        : 0;

      await db
        .update(voiceCalls)
        .set({
          status: 'completed',
          answeredAt: call.answerTime,
          endedAt: call.endTime,
          durationSeconds: duration,
          endCause,
          clientId: call.callerInfo?.clientId ? parseInt(call.callerInfo.clientId) : null,
          callerRecognized: call.callerInfo?.isRecognized || false,
        })
        .where(eq(voiceCalls.id, call.id));

      for (const event of call.events) {
        await db.insert(voiceCallEvents).values({
          voiceCallId: call.id,
          eventType: event.type,
          eventData: event.data || {},
          timestamp: event.timestamp,
        });
      }
    } catch (error) {
      console.error(`[CallManager] Error updating call in database:`, error);
    }
  }

  private startTimeoutChecker(): void {
    setInterval(() => {
      const now = Date.now();

      this.activeCalls.forEach((call, callId) => {
        const callAge = now - call.startTime.getTime();
        const idleAge = now - call.lastActivityTime.getTime();

        if (callAge > this.callTimeout) {
          console.warn(`[CallManager] Call ${callId} exceeded max duration`);
          this.endCall(callId, 'ALLOTTED_TIMEOUT');
        } else if (idleAge > this.idleTimeout && call.state === 'listening') {
          console.warn(`[CallManager] Call ${callId} idle timeout`);
          this.endCall(callId, 'RECOVERY_ON_TIMER_EXPIRE');
        }
      });
    }, 10000);
  }

  getActiveCall(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  getActiveCallCount(): number {
    return this.activeCalls.size;
  }

  getCallByUUID(uuid: string): ActiveCall | undefined {
    const callId = this.uuidToCallId.get(uuid);
    return callId ? this.activeCalls.get(callId) : undefined;
  }
}

export const callManager = new VoiceCallManager();
