import { Connection, Event as ESLEvent } from 'modesl';
import { voiceConfig } from './config';
import { EventEmitter } from 'events';

interface ESLConfig {
  host: string;
  port: number;
  password: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type ChannelEventHandler = (event: ESLEvent) => void;

export class VoiceESLClient extends EventEmitter {
  private connection: Connection | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private config: ESLConfig;

  private channelCreateHandlers: ChannelEventHandler[] = [];
  private channelAnswerHandlers: ChannelEventHandler[] = [];
  private channelHangupHandlers: ChannelEventHandler[] = [];
  private dtmfHandlers: ChannelEventHandler[] = [];

  constructor(config?: Partial<ESLConfig>) {
    super();
    this.config = {
      host: config?.host || voiceConfig.freeswitch.eslHost,
      port: config?.port || voiceConfig.freeswitch.eslPort,
      password: config?.password || voiceConfig.freeswitch.eslPassword,
    };
  }

  async connect(): Promise<void> {
    if (this.connectionState === 'connected') {
      console.log('[ESL] Already connected');
      return;
    }

    this.connectionState = 'connecting';
    console.log(`[ESL] Connecting to ${this.config.host}:${this.config.port}...`);

    return new Promise((resolve, reject) => {
      try {
        this.connection = new Connection(
          this.config.host,
          this.config.port,
          this.config.password
        );

        this.connection.on('esl::ready', () => {
          console.log('[ESL] Connected and authenticated');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.subscribeToEvents();
          this.emit('connected');
          resolve();
        });

        this.connection.on('error', (error: Error) => {
          console.error('[ESL] Connection error:', error.message);
          this.emit('error', error);
          if (this.connectionState === 'connecting') {
            reject(error);
          }
        });

        this.connection.on('esl::end', () => {
          console.log('[ESL] Connection closed');
          this.connectionState = 'disconnected';
          this.emit('disconnected');
          this.scheduleReconnect();
        });
      } catch (error) {
        console.error('[ESL] Failed to create connection:', error);
        this.connectionState = 'disconnected';
        reject(error);
      }
    });
  }

  private subscribeToEvents(): void {
    if (!this.connection) return;

    this.connection.subscribe([
      'CHANNEL_CREATE',
      'CHANNEL_ANSWER',
      'CHANNEL_HANGUP',
      'DTMF',
      'CUSTOM',
      'HEARTBEAT'
    ], (err) => {
      if (err) {
        console.error('[ESL] Failed to subscribe to events:', err);
        return;
      }
      console.log('[ESL] Subscribed to events');
    });

    this.connection.on('esl::event::CHANNEL_CREATE::*', (event: ESLEvent) => {
      this.channelCreateHandlers.forEach(h => h(event));
      this.emit('channel:create', event);
    });

    this.connection.on('esl::event::CHANNEL_ANSWER::*', (event: ESLEvent) => {
      this.channelAnswerHandlers.forEach(h => h(event));
      this.emit('channel:answer', event);
    });

    this.connection.on('esl::event::CHANNEL_HANGUP::*', (event: ESLEvent) => {
      this.channelHangupHandlers.forEach(h => h(event));
      this.emit('channel:hangup', event);
    });

    this.connection.on('esl::event::DTMF::*', (event: ESLEvent) => {
      this.dtmfHandlers.forEach(h => h(event));
      this.emit('dtmf', event);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[ESL] Max reconnect attempts reached');
      this.emit('reconnect:failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';

    console.log(`[ESL] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[ESL] Reconnect failed:', error);
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }

    this.connectionState = 'disconnected';
    console.log('[ESL] Disconnected');
  }

  onChannelCreate(handler: ChannelEventHandler): void {
    this.channelCreateHandlers.push(handler);
  }

  onChannelAnswer(handler: ChannelEventHandler): void {
    this.channelAnswerHandlers.push(handler);
  }

  onChannelHangup(handler: ChannelEventHandler): void {
    this.channelHangupHandlers.push(handler);
  }

  onDTMF(handler: ChannelEventHandler): void {
    this.dtmfHandlers.push(handler);
  }

  async answer(uuid: string): Promise<void> {
    return this.executeCommand(`uuid_answer ${uuid}`);
  }

  async playback(uuid: string, filePath: string): Promise<void> {
    return this.executeCommand(`uuid_broadcast ${uuid} ${filePath} aleg`);
  }

  async broadcast(uuid: string, filePath: string, leg: 'aleg' | 'bleg' | 'both' = 'aleg'): Promise<void> {
    return this.executeCommand(`uuid_broadcast ${uuid} ${filePath} ${leg}`);
  }

  async transfer(uuid: string, destination: string): Promise<void> {
    return this.executeCommand(`uuid_transfer ${uuid} ${destination}`);
  }

  async hangup(uuid: string, cause: string = 'NORMAL_CLEARING'): Promise<void> {
    return this.executeCommand(`uuid_kill ${uuid} ${cause}`);
  }

  async recordStart(uuid: string, filePath: string): Promise<void> {
    return this.executeCommand(`uuid_record ${uuid} start ${filePath}`);
  }

  async recordStop(uuid: string): Promise<void> {
    return this.executeCommand(`uuid_record ${uuid} stop all`);
  }

  async setVariable(uuid: string, variable: string, value: string): Promise<void> {
    return this.executeCommand(`uuid_setvar ${uuid} ${variable} ${value}`);
  }

  async getVariable(uuid: string, variable: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('Not connected to ESL'));
        return;
      }

      this.connection.api(`uuid_getvar ${uuid} ${variable}`, (res: ESLEvent) => {
        const body = res.getBody();
        if (body && body !== '_undef_') {
          resolve(body.trim());
        } else {
          resolve(null);
        }
      });
    });
  }

  private async executeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error('Not connected to ESL'));
        return;
      }

      this.connection.api(command, (res: ESLEvent) => {
        const body = res.getBody();
        if (body && body.startsWith('-ERR')) {
          reject(new Error(`ESL command failed: ${body}`));
        } else {
          resolve();
        }
      });
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.executeCommand('status');
      return true;
    } catch {
      return false;
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }
}

export const eslClient = new VoiceESLClient();
