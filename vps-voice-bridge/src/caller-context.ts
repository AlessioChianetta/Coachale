import { config } from './config.js';
import { logger } from './logger.js';
import type { ClientContext } from './session-manager.js';

const log = logger.child('CONTEXT');

interface CallerContextResponse {
  found: boolean;
  user?: {
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
  };
  consultant?: {
    id: string;
    name: string;
  };
}

export async function fetchCallerContext(callerId: string): Promise<ClientContext | null> {
  if (!config.replit.apiUrl || !config.replit.apiToken) {
    log.debug(`Replit API not configured, skipping context fetch`);
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(callerId);
  
  try {
    log.debug(`Fetching caller context`, { callerId, normalized: normalizedPhone });

    const response = await fetch(
      `${config.replit.apiUrl}/api/voice/caller-context?phone=${encodeURIComponent(normalizedPhone)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.replit.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        log.debug(`Caller not found in database`, { callerId });
        return null;
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as CallerContextResponse;
    
    if (!data.found) {
      log.debug(`Caller not recognized`, { callerId });
      return null;
    }

    const context: ClientContext = {
      userId: data.user?.id,
      userName: data.user?.name,
      consultantId: data.consultant?.id,
      consultantName: data.consultant?.name,
      role: data.user?.role,
      phoneNumber: data.user?.phoneNumber,
    };

    log.info(`Caller context loaded`, {
      callerId,
      userId: context.userId?.slice(0, 8),
      userName: context.userName,
    });

    return context;

  } catch (error) {
    log.error(`Failed to fetch caller context`, {
      callerId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  } else if (!phone.startsWith('+')) {
    if (normalized.startsWith('39') && normalized.length > 10) {
      normalized = '+' + normalized;
    } else if (normalized.length === 10) {
      normalized = '+39' + normalized;
    } else {
      normalized = '+' + normalized;
    }
  } else {
    normalized = phone;
  }

  return normalized;
}

interface NumberOwnerResponse {
  found: boolean;
  consultant_id?: string;
  display_name?: string;
}

export async function fetchNumberOwner(calledNumber: string): Promise<NumberOwnerResponse | null> {
  if (!config.replit.apiUrl || !config.replit.apiToken) {
    log.debug(`Replit API not configured, skipping number owner lookup`);
    return null;
  }

  try {
    log.debug(`Fetching number owner`, { calledNumber });

    const response = await fetch(
      `${config.replit.apiUrl}/api/voice/number-lookup?phone=${encodeURIComponent(calledNumber)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.replit.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NumberOwnerResponse;

    if (data.found) {
      log.info(`Number owner found`, {
        calledNumber,
        consultant_id: data.consultant_id?.slice(0, 8),
        display_name: data.display_name,
      });
    } else {
      log.debug(`Number owner not found`, { calledNumber });
    }

    return data;

  } catch (error) {
    log.error(`Failed to fetch number owner`, {
      calledNumber,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

export async function notifyCallStart(
  sessionId: string,
  callerId: string,
  calledNumber: string
): Promise<void> {
  if (!config.replit.apiUrl || !config.replit.apiToken) {
    return;
  }

  try {
    await fetch(`${config.replit.apiUrl}/api/voice/call-start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.replit.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        callerId: normalizePhoneNumber(callerId),
        calledNumber,
        startTime: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    log.debug(`Call start notified to Replit`, { sessionId: sessionId.slice(0, 8) });

  } catch (error) {
    log.warn(`Failed to notify call start`, {
      sessionId: sessionId.slice(0, 8),
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

export async function notifyCallEnd(
  sessionId: string,
  duration: number,
  bytesIn: number,
  bytesOut: number,
  reason: string
): Promise<void> {
  if (!config.replit.apiUrl || !config.replit.apiToken) {
    return;
  }

  try {
    await fetch(`${config.replit.apiUrl}/api/voice/call-end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.replit.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        duration,
        bytesIn,
        bytesOut,
        reason,
        endTime: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });

    log.debug(`Call end notified to Replit`, { sessionId: sessionId.slice(0, 8) });

  } catch (error) {
    log.warn(`Failed to notify call end`, {
      sessionId: sessionId.slice(0, 8),
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
