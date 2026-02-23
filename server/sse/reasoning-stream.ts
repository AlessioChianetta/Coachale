import { Response } from "express";
import { EventEmitter } from "events";

export interface ReasoningSSEEvent {
  type: 'cycle_start' | 'role_start' | 'step_start' | 'step_complete' | 'role_complete' | 'cycle_complete' | 'error';
  cycleId: string;
  roleId?: string;
  roleName?: string;
  stepNumber?: number;
  stepTitle?: string;
  stepType?: string;
  stepContent?: string;
  stepDurationMs?: number;
  totalSteps?: number;
  tasksGenerated?: number;
  reasoningMode?: string;
  timestamp: number;
}

const reasoningEmitter = new EventEmitter();
reasoningEmitter.setMaxListeners(100);

const clientConnections = new Map<string, Set<Response>>();

export function addReasoningClient(consultantId: string, res: Response): void {
  if (!clientConnections.has(consultantId)) {
    clientConnections.set(consultantId, new Set());
  }
  clientConnections.get(consultantId)!.add(res);
  console.log(`📡 [SSE] Client connected for consultant ${consultantId} (${clientConnections.get(consultantId)!.size} active)`);
}

export function removeReasoningClient(consultantId: string, res: Response): void {
  const clients = clientConnections.get(consultantId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      clientConnections.delete(consultantId);
    }
    console.log(`📡 [SSE] Client disconnected for consultant ${consultantId} (${clients.size} remaining)`);
  }
}

export function emitReasoningEvent(consultantId: string, event: ReasoningSSEEvent): void {
  const clients = clientConnections.get(consultantId);
  if (!clients || clients.size === 0) return;

  const json = JSON.stringify(event);
  const message = `data: ${json}\n\n`;

  const deadClients: Response[] = [];

  for (const res of clients) {
    try {
      res.write(message);
    } catch (err) {
      deadClients.push(res);
    }
  }

  for (const dead of deadClients) {
    clients.delete(dead);
    console.log(`📡 [SSE] Removed dead connection for consultant ${consultantId}`);
  }

  if (clients.size === 0) {
    clientConnections.delete(consultantId);
  }

  const summary = `type=${event.type}` +
    (event.roleName ? ` role=${event.roleName}` : '') +
    (event.stepNumber ? ` step=${event.stepNumber}` : '') +
    (event.stepTitle ? ` "${event.stepTitle}"` : '');
  console.log(`📡 [SSE] ${consultantId}: ${summary}`);
}
