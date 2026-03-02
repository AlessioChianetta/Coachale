import cron from 'node-cron';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { isTelnyxConfigured, checkRequirementStatus, checkOrderStatus } from '../services/telnyx-provisioning';
import { withCronLock } from './cron-lock-manager';

let schedulerTask: cron.ScheduledTask | null = null;

const CRON_JOB_NAME = 'telnyx-provisioning-poller';
const SCHEDULE = process.env.TELNYX_POLLING_SCHEDULE || '*/15 * * * *';

export function initTelnyxProvisioningPoller() {
  if (schedulerTask) {
    console.log('[TELNYX-POLLER] Already initialized, skipping');
    return;
  }

  console.log(`[TELNYX-POLLER] Initializing with schedule: ${SCHEDULE}`);

  schedulerTask = cron.schedule(SCHEDULE, async () => {
    await runPollingCycle();
  }, {
    timezone: 'Europe/Rome'
  });

  console.log('[TELNYX-POLLER] Scheduled successfully');
}

async function runPollingCycle() {
  const result = await withCronLock(CRON_JOB_NAME, async () => {
    const configured = await isTelnyxConfigured();
    if (!configured) {
      return;
    }

    console.log('[TELNYX-POLLER] Starting polling cycle...');

    await pollKycRequests();
    await pollNumberOrders();

    console.log('[TELNYX-POLLER] Polling cycle complete');
  }, { lockDurationMs: 120000 });
}

async function pollKycRequests() {
  const pendingKyc = await db.execute(sql`
    SELECT id, telnyx_requirement_group_id, status
    FROM voip_provisioning_requests
    WHERE status = 'kyc_submitted'
      AND telnyx_requirement_group_id IS NOT NULL
      AND provider = 'telnyx'
  `);

  if (pendingKyc.rows.length === 0) return;

  console.log(`[TELNYX-POLLER] Checking ${pendingKyc.rows.length} pending KYC request(s)`);

  for (const row of pendingKyc.rows as any[]) {
    try {
      const result = await checkRequirementStatus(row.telnyx_requirement_group_id);
      console.log(`[TELNYX-POLLER] Request ${row.id}: requirement_group status = ${result.status}`);

      if (result.status === 'approved') {
        await db.execute(sql`
          UPDATE voip_provisioning_requests
          SET status = 'kyc_approved',
              error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] POLLER: KYC approved\n`},
              updated_at = NOW()
          WHERE id = ${row.id} AND status = 'kyc_submitted'
        `);
        console.log(`[TELNYX-POLLER] Request ${row.id} → kyc_approved`);
      } else if (result.status === 'action-required' || result.status === 'rejected' || result.status === 'declined') {
        await db.execute(sql`
          UPDATE voip_provisioning_requests
          SET status = 'rejected',
              error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] POLLER: KYC ${result.status}\n`},
              updated_at = NOW()
          WHERE id = ${row.id} AND status = 'kyc_submitted'
        `);
        console.log(`[TELNYX-POLLER] Request ${row.id} → rejected (${result.status})`);
      }
    } catch (error: any) {
      console.error(`[TELNYX-POLLER] Error checking KYC for request ${row.id}:`, error.message);
    }
  }
}

async function pollNumberOrders() {
  const pendingOrders = await db.execute(sql`
    SELECT id, telnyx_number_order_id, status, desired_number
    FROM voip_provisioning_requests
    WHERE status = 'number_ordered'
      AND telnyx_number_order_id IS NOT NULL
      AND provider = 'telnyx'
  `);

  if (pendingOrders.rows.length === 0) return;

  console.log(`[TELNYX-POLLER] Checking ${pendingOrders.rows.length} pending number order(s)`);

  for (const row of pendingOrders.rows as any[]) {
    try {
      const result = await checkOrderStatus(row.telnyx_number_order_id);
      console.log(`[TELNYX-POLLER] Request ${row.id}: number_order status = ${result.status}`);

      if (result.status === 'success') {
        const assignedNumber = result.phoneNumbers?.[0]?.phone_number || row.desired_number || null;
        await db.execute(sql`
          UPDATE voip_provisioning_requests
          SET status = 'number_active',
              assigned_number = COALESCE(${assignedNumber}, assigned_number),
              error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] POLLER: Number order completed, number: ${assignedNumber || 'unknown'}\n`},
              updated_at = NOW()
          WHERE id = ${row.id} AND status = 'number_ordered'
        `);
        console.log(`[TELNYX-POLLER] Request ${row.id} → number_active (${assignedNumber})`);
      } else if (result.status === 'failure') {
        await db.execute(sql`
          UPDATE voip_provisioning_requests
          SET status = 'rejected',
              error_log = COALESCE(error_log, '') || ${`[${new Date().toISOString()}] POLLER: Number order failed\n`},
              updated_at = NOW()
          WHERE id = ${row.id} AND status = 'number_ordered'
        `);
        console.log(`[TELNYX-POLLER] Request ${row.id} → rejected (order failed)`);
      }
    } catch (error: any) {
      console.error(`[TELNYX-POLLER] Error checking order for request ${row.id}:`, error.message);
    }
  }
}
