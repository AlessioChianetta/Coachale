const scheduledCallTimers = new Map<string, NodeJS.Timeout>();

type ExecuteOutboundCallFn = (callId: string, consultantId: string) => Promise<{ success: boolean; error?: string }>;
type IsCallApprovedFn = (callId: string) => Promise<boolean>;

let _executeOutboundCall: ExecuteOutboundCallFn | null = null;
let _isCallApproved: IsCallApprovedFn | null = null;

export function registerCallFunctions(
  executeOutboundCall: ExecuteOutboundCallFn,
  isCallApproved: IsCallApprovedFn
): void {
  _executeOutboundCall = executeOutboundCall;
  _isCallApproved = isCallApproved;
  console.log(`✅ [CALL-TIMER] Functions registered`);
}

export function scheduleTimer(callId: string, consultantId: string, scheduledAt: Date): void {
  const now = new Date();
  const delayMs = scheduledAt.getTime() - now.getTime();

  const executeIfApproved = async () => {
    scheduledCallTimers.delete(callId);
    if (_isCallApproved) {
      const approved = await _isCallApproved(callId);
      if (!approved) {
        console.log(`🚫 [Outbound] Call ${callId} skipped: linked AI task not yet approved`);
        return;
      }
    }
    if (_executeOutboundCall) {
      _executeOutboundCall(callId, consultantId);
    } else {
      console.error(`❌ [CALL-TIMER] executeOutboundCall not registered, cannot execute ${callId}`);
    }
  };

  if (delayMs <= 0) {
    executeIfApproved();
  } else {
    const timer = setTimeout(() => executeIfApproved(), delayMs);
    scheduledCallTimers.set(callId, timer);
    console.log(`⏰ [Outbound] Scheduled call ${callId} for ${scheduledAt.toISOString()} (in ${Math.round(delayMs / 1000)}s)`);
  }
}

export function cancelTimer(callId: string): void {
  const timer = scheduledCallTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    scheduledCallTimers.delete(callId);
    console.log(`🚫 [Outbound] Cancelled timer for ${callId}`);
  }
}

export function getTimerCount(): number {
  return scheduledCallTimers.size;
}

export function hasTimer(callId: string): boolean {
  return scheduledCallTimers.has(callId);
}

const callTimerManager = {
  scheduleTimer,
  cancelTimer,
  getTimerCount,
  hasTimer,
  registerCallFunctions,
};

let _managerReady = false;

export function initCallTimerManager(): typeof callTimerManager {
  _managerReady = true;
  return callTimerManager;
}

export function getCallTimerManager(): typeof callTimerManager | null {
  return _managerReady ? callTimerManager : null;
}
