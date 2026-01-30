import { db } from "../db";
import { pendingBookings } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { ensureScheduler } from "../services/scheduler-registry";

export async function expirePendingBookings(): Promise<void> {
  try {
    const result = await db
      .update(pendingBookings)
      .set({ status: "expired" })
      .where(
        and(
          eq(pendingBookings.status, "awaiting_confirm"),
          sql`${pendingBookings.expiresAt} < NOW()`
        )
      )
      .returning({ token: pendingBookings.token });

    if (result.length > 0) {
      console.log(`🕐 [PENDING BOOKING EXPIRY] Expired ${result.length} pending booking(s)`);
      result.forEach(r => console.log(`   - Token: ${r.token.slice(0, 8)}...`));
    }
  } catch (error: any) {
    console.error(`❌ [PENDING BOOKING EXPIRY] Error:`, error.message);
  }
}

export function startPendingBookingExpiryScheduler(): void {
  const registrationId = `pending-booking-expiry-${Date.now()}`;
  
  ensureScheduler(
    "pending-booking-expiry",
    "*/2 * * * *",
    expirePendingBookings,
    registrationId
  );
  
  console.log(`✅ [PENDING BOOKING EXPIRY] Scheduler started (every 2 minutes)`);
}
