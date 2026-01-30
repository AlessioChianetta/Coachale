import { Router, Request, Response } from 'express';
import { db } from '../db';
import { consultantAvailabilitySettings, appointmentBookings } from '../../shared/schema';
import { eq, and, isNotNull, gte, lte } from 'drizzle-orm';
import { fetchGoogleCalendarEvents } from '../google-calendar-service';

const router = Router();

interface CalendarChannel {
  consultantId: string;
  channelId: string;
  resourceId: string;
  expiration: Date;
}

const activeChannels = new Map<string, CalendarChannel>();

async function loadChannelsFromDB(): Promise<void> {
  try {
    const now = new Date();
    const settings = await db
      .select({
        consultantId: consultantAvailabilitySettings.consultantId,
        webhookChannelId: consultantAvailabilitySettings.webhookChannelId,
        webhookResourceId: consultantAvailabilitySettings.webhookResourceId,
        webhookExpiration: consultantAvailabilitySettings.webhookExpiration,
      })
      .from(consultantAvailabilitySettings)
      .where(
        and(
          isNotNull(consultantAvailabilitySettings.webhookChannelId),
          isNotNull(consultantAvailabilitySettings.webhookResourceId),
          isNotNull(consultantAvailabilitySettings.webhookExpiration),
          gte(consultantAvailabilitySettings.webhookExpiration, now)
        )
      );
    
    for (const s of settings) {
      if (s.webhookChannelId && s.webhookResourceId && s.webhookExpiration) {
        activeChannels.set(s.webhookChannelId, {
          consultantId: s.consultantId,
          channelId: s.webhookChannelId,
          resourceId: s.webhookResourceId,
          expiration: s.webhookExpiration,
        });
      }
    }
    
    console.log(`✅ [CALENDAR WEBHOOK] Loaded ${activeChannels.size} active channels from DB`);
  } catch (error: any) {
    console.error(`❌ [CALENDAR WEBHOOK] Error loading channels from DB:`, error.message);
  }
}

loadChannelsFromDB();

async function saveChannelToDB(consultantId: string, channelId: string, resourceId: string, expiration: Date): Promise<void> {
  try {
    await db
      .update(consultantAvailabilitySettings)
      .set({
        webhookChannelId: channelId,
        webhookResourceId: resourceId,
        webhookExpiration: expiration,
        updatedAt: new Date(),
      })
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
    
    console.log(`💾 [CALENDAR WEBHOOK] Saved channel ${channelId} to DB for consultant ${consultantId}`);
  } catch (error: any) {
    console.error(`❌ [CALENDAR WEBHOOK] Error saving channel to DB:`, error.message);
  }
}

async function removeChannelFromDB(consultantId: string): Promise<void> {
  try {
    await db
      .update(consultantAvailabilitySettings)
      .set({
        webhookChannelId: null,
        webhookResourceId: null,
        webhookExpiration: null,
        updatedAt: new Date(),
      })
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId));
    
    console.log(`🗑️ [CALENDAR WEBHOOK] Removed channel from DB for consultant ${consultantId}`);
  } catch (error: any) {
    console.error(`❌ [CALENDAR WEBHOOK] Error removing channel from DB:`, error.message);
  }
}

async function lookupChannelByResourceId(resourceId: string): Promise<CalendarChannel | undefined> {
  for (const channel of activeChannels.values()) {
    if (channel.resourceId === resourceId) {
      return channel;
    }
  }
  
  try {
    const [settings] = await db
      .select({
        consultantId: consultantAvailabilitySettings.consultantId,
        webhookChannelId: consultantAvailabilitySettings.webhookChannelId,
        webhookResourceId: consultantAvailabilitySettings.webhookResourceId,
        webhookExpiration: consultantAvailabilitySettings.webhookExpiration,
      })
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.webhookResourceId, resourceId))
      .limit(1);
    
    if (settings?.webhookChannelId && settings?.webhookExpiration) {
      const channel: CalendarChannel = {
        consultantId: settings.consultantId,
        channelId: settings.webhookChannelId,
        resourceId: resourceId,
        expiration: settings.webhookExpiration,
      };
      activeChannels.set(settings.webhookChannelId, channel);
      return channel;
    }
  } catch (error: any) {
    console.error(`❌ [CALENDAR WEBHOOK] Error looking up channel by resourceId:`, error.message);
  }
  
  return undefined;
}

router.post('/google-calendar/webhook', async (req: Request, res: Response) => {
  const resourceState = req.headers['x-goog-resource-state'] as string | undefined;
  const channelId = req.headers['x-goog-channel-id'] as string | undefined;
  const resourceId = req.headers['x-goog-resource-id'] as string | undefined;
  const messageNumber = req.headers['x-goog-message-number'] as string | undefined;
  
  console.log(`📥 [CALENDAR WEBHOOK] Received notification`);
  console.log(`   State: ${resourceState}`);
  console.log(`   Channel ID: ${channelId}`);
  console.log(`   Resource ID: ${resourceId}`);
  console.log(`   Message #: ${messageNumber}`);
  
  res.status(200).send('OK');
  
  if (resourceState === 'sync') {
    console.log(`ℹ️ [CALENDAR WEBHOOK] Initial sync message received, ignoring`);
    return;
  }
  
  if (!channelId || !resourceId) {
    console.warn(`⚠️ [CALENDAR WEBHOOK] Missing channelId or resourceId`);
    return;
  }
  
  try {
    let channel = activeChannels.get(channelId);
    
    if (!channel) {
      channel = await lookupChannelByResourceId(resourceId);
    }
    
    if (!channel) {
      console.warn(`⚠️ [CALENDAR WEBHOOK] Channel not found: ${channelId}`);
      return;
    }
    
    if (channel.expiration < new Date()) {
      console.log(`⏰ [CALENDAR WEBHOOK] Channel ${channelId} expired, removing`);
      activeChannels.delete(channelId);
      await removeChannelFromDB(channel.consultantId);
      return;
    }
    
    if (resourceState === 'exists' || resourceState === 'update' || resourceState === 'notFound') {
      console.log(`🔄 [CALENDAR WEBHOOK] Calendar changed for consultant ${channel.consultantId} (state: ${resourceState})`);
      await syncCalendarBookings(channel.consultantId);
    }
  } catch (error: any) {
    console.error(`❌ [CALENDAR WEBHOOK] Error processing notification:`, error.message);
  }
});

router.get('/google-calendar/webhook', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'active',
    message: 'Google Calendar webhook endpoint is active',
    activeChannels: activeChannels.size,
    timestamp: new Date().toISOString()
  });
});

async function syncCalendarBookings(consultantId: string): Promise<void> {
  const cutoffDate = new Date('2026-01-01');
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);
  
  try {
    const bookingsToCheck = await db
      .select({
        id: appointmentBookings.id,
        googleEventId: appointmentBookings.googleEventId,
        appointmentDate: appointmentBookings.appointmentDate,
        appointmentTime: appointmentBookings.appointmentTime,
        clientName: appointmentBookings.clientName,
        status: appointmentBookings.status,
      })
      .from(appointmentBookings)
      .where(
        and(
          eq(appointmentBookings.consultantId, consultantId),
          isNotNull(appointmentBookings.googleEventId),
          gte(appointmentBookings.appointmentDate, cutoffDate),
          eq(appointmentBookings.status, 'confirmed')
        )
      );
    
    if (bookingsToCheck.length === 0) {
      console.log(`✅ [CALENDAR WEBHOOK] No bookings to sync for consultant ${consultantId}`);
      return;
    }
    
    const googleEvents = await fetchGoogleCalendarEvents(consultantId, now, futureDate);
    const googleEventIds = new Set(googleEvents.map(e => e.id));
    
    let cancelledCount = 0;
    
    for (const booking of bookingsToCheck) {
      if (booking.googleEventId && !googleEventIds.has(booking.googleEventId)) {
        console.log(`🗑️ [CALENDAR WEBHOOK] Event deleted - cancelling booking ${booking.id} (${booking.clientName})`);
        
        await db
          .update(appointmentBookings)
          .set({
            status: 'cancelled',
            cancellationReason: 'Evento cancellato da Google Calendar',
            cancelledAt: new Date(),
            updatedAt: new Date(),
            googleEventId: null,
          })
          .where(eq(appointmentBookings.id, booking.id));
        
        cancelledCount++;
      }
    }
    
    console.log(`✅ [CALENDAR WEBHOOK] Sync complete: checked ${bookingsToCheck.length}, cancelled ${cancelledCount}`);
  } catch (error) {
    console.error(`❌ [CALENDAR WEBHOOK] Error syncing bookings:`, error);
  }
}

export async function registerChannel(consultantId: string, channelId: string, resourceId: string, expiration: Date): Promise<void> {
  activeChannels.set(channelId, { consultantId, channelId, resourceId, expiration });
  await saveChannelToDB(consultantId, channelId, resourceId, expiration);
  console.log(`✅ [CALENDAR WEBHOOK] Registered channel ${channelId} for consultant ${consultantId}`);
}

export async function unregisterChannel(channelId: string): Promise<void> {
  const channel = activeChannels.get(channelId);
  if (channel) {
    activeChannels.delete(channelId);
    await removeChannelFromDB(channel.consultantId);
    console.log(`✅ [CALENDAR WEBHOOK] Unregistered channel ${channelId}`);
  }
}

export function getActiveChannelsCount(): number {
  return activeChannels.size;
}

export default router;
