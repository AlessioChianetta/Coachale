/**
 * Consultation Tool Executor
 * Handles execution of consultation-related function calls from the AI
 */

import { db } from "../db";
import { consultations, users, consultantClients, consultantAvailabilitySettings, pendingBookings, consultantWhatsappConfig } from "@shared/schema";
import { eq, and, gte, lte, sql, or, desc, isNull } from "drizzle-orm";
import { ConsultationToolResult } from "./consultation-tools";
import crypto from "crypto";
import { getValidAccessToken, createGoogleCalendarEvent, deleteGoogleCalendarEvent } from "../google-calendar-service";
import { setBookingFlowState, clearBookingFlowState, setPostBookingContext, clearPostBookingContext } from "../booking/booking-flow-service";

export async function executeConsultationTool(
  toolName: string,
  args: Record<string, any>,
  clientId: string,
  consultantId: string,
  conversationId?: string | null,
  agentConfigId?: string
): Promise<ConsultationToolResult> {
  console.log(`🔧 [CONSULTATION TOOL] Executing ${toolName} for client ${clientId.slice(0, 8)}`);
  console.log(`   Args:`, JSON.stringify(args));
  console.log(`   ConversationId: ${conversationId || 'none'}`);
  console.log(`   AgentConfigId: ${agentConfigId || 'none'}`);

  try {
    switch (toolName) {
      case "getConsultationStatus":
        return await executeGetConsultationStatus(clientId, consultantId, args);
      case "getAvailableSlots":
        return await executeGetAvailableSlots(clientId, consultantId, args, conversationId, agentConfigId);
      case "proposeBooking":
        return await executeProposeBooking(clientId, consultantId, args, conversationId);
      case "confirmBooking":
        return await executeConfirmBooking(clientId, args, conversationId);
      case "cancelBooking":
        return await executeCancelBooking(clientId, consultantId, args, conversationId);
      case "rescheduleBooking":
        return await executeRescheduleBooking(clientId, consultantId, args, conversationId);
      default:
        return {
          toolName,
          args,
          result: null,
          success: false,
          error: `Tool non riconosciuto: ${toolName}`
        };
    }
  } catch (error: any) {
    console.error(`❌ [CONSULTATION TOOL] Error executing ${toolName}:`, error);
    return {
      toolName,
      args,
      result: null,
      success: false,
      error: error.message || "Errore durante l'esecuzione del tool"
    };
  }
}

async function executeGetConsultationStatus(
  clientId: string,
  consultantId: string,
  args: { month?: number; year?: number }
): Promise<ConsultationToolResult> {
  const now = new Date();
  
  // Guardrail: validate month/year if provided
  if (args.month !== undefined && (args.month < 1 || args.month > 12)) {
    return {
      toolName: "getConsultationStatus",
      args,
      result: { 
        error_code: "INVALID_MONTH",
        message: "Il mese deve essere un numero tra 1 e 12",
        suggestion: "Specifica un mese valido (es: 1 per gennaio, 12 per dicembre)"
      },
      success: false,
      error: "Mese non valido"
    };
  }
  
  if (args.year !== undefined && (args.year < 2020 || args.year > 2030)) {
    return {
      toolName: "getConsultationStatus",
      args,
      result: { 
        error_code: "INVALID_YEAR",
        message: "L'anno deve essere compreso tra 2020 e 2030",
        suggestion: "Specifica un anno valido"
      },
      success: false,
      error: "Anno non valido"
    };
  }
  
  const month = args.month || (now.getMonth() + 1);
  const year = args.year || now.getFullYear();

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const [clientData] = await db
    .select({
      monthlyLimit: users.monthlyConsultationLimit,
      firstName: users.firstName,
      lastName: users.lastName
    })
    .from(users)
    .where(eq(users.id, clientId));

  const monthlyLimit = clientData?.monthlyLimit || null;

  const monthConsultations = await db
    .select({
      id: consultations.id,
      scheduledAt: consultations.scheduledAt,
      status: consultations.status,
      duration: consultations.duration,
      notes: consultations.notes
    })
    .from(consultations)
    .where(
      and(
        eq(consultations.clientId, clientId),
        gte(consultations.scheduledAt, startOfMonth),
        lte(consultations.scheduledAt, endOfMonth),
        or(
          eq(consultations.status, "completed"),
          eq(consultations.status, "scheduled")
        )
      )
    )
    .orderBy(consultations.scheduledAt);

  const completed = monthConsultations.filter(c => c.status === "completed");
  const scheduled = monthConsultations.filter(c => c.status === "scheduled");

  const completedCount = completed.length;
  const scheduledCount = scheduled.length;
  const totalUsed = completedCount + scheduledCount;
  const remaining = monthlyLimit ? Math.max(0, monthlyLimit - totalUsed) : null;
  const isLimitReached = monthlyLimit ? totalUsed >= monthlyLimit : false;

  const monthNames = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
  ];

  const result = {
    period: {
      month: monthNames[month - 1],
      monthNumber: month,
      year: year
    },
    counts: {
      completed: completedCount,
      scheduled: scheduledCount,
      totalUsed: totalUsed
    },
    limit: {
      monthly: monthlyLimit,
      remaining: remaining,
      isLimitReached: isLimitReached,
      isUnlimited: monthlyLimit === null
    },
    details: {
      completedConsultations: completed.map(c => ({
        date: new Date(c.scheduledAt).toLocaleDateString('it-IT', { 
          weekday: 'long', day: 'numeric', month: 'long' 
        }),
        duration: c.duration
      })),
      scheduledConsultations: scheduled.map(c => ({
        date: new Date(c.scheduledAt).toLocaleDateString('it-IT', { 
          weekday: 'long', day: 'numeric', month: 'long' 
        }),
        time: new Date(c.scheduledAt).toLocaleTimeString('it-IT', { 
          hour: '2-digit', minute: '2-digit' 
        }),
        duration: c.duration
      }))
    },
    summary: monthlyLimit
      ? `Hai effettuato ${completedCount} consulenze e ne hai ${scheduledCount} prenotate, per un totale di ${totalUsed}/${monthlyLimit} questo mese. ${isLimitReached ? 'Hai raggiunto il limite mensile.' : `Ti restano ${remaining} consulenze disponibili.`}`
      : `Hai effettuato ${completedCount} consulenze e ne hai ${scheduledCount} prenotate questo mese. Non hai un limite mensile impostato.`,
    unit: "sessions",
    next_action_hint: isLimitReached 
      ? "limit_reached_no_booking" 
      : remaining && remaining > 0 
        ? "offer_booking" 
        : "no_action"
  };

  console.log(`✅ [CONSULTATION TOOL] getConsultationStatus result:`, JSON.stringify(result.counts));
  console.log(`   next_action_hint: ${result.next_action_hint}`);

  return {
    toolName: "getConsultationStatus",
    args,
    result,
    success: true
  };
}

async function executeGetAvailableSlots(
  clientId: string,
  consultantId: string,
  args: { 
    startDate?: string; 
    endDate?: string; 
    preferredDayOfWeek?: string;
    preferredTimeRange?: string;
  },
  conversationId?: string | null,
  agentConfigId?: string
): Promise<ConsultationToolResult> {
  const now = new Date();
  
  type TimeSlot = { start: string; end: string };
  type DayAvailability = { enabled: boolean; slots: TimeSlot[] };

  const dayNameToNumber: Record<string, string> = {
    sunday: "0", monday: "1", tuesday: "2", wednesday: "3",
    thursday: "4", friday: "5", saturday: "6"
  };

  let appointmentDuration = 60;
  let bufferBefore = 15;
  let bufferAfter = 15;
  let minHoursNotice = 24;
  let maxDaysAhead = 30;
  let timezone = "Europe/Rome";
  let settings: any = null;
  let rawAvailabilityData: Record<string, any> | null = null;
  let defaultMorningStart = "09:00";
  let defaultMorningEnd = "13:00";
  let defaultAfternoonStart = "15:00";
  let defaultAfternoonEnd = "18:00";

  if (agentConfigId) {
    const [agentConfig] = await db
      .select()
      .from(consultantWhatsappConfig)
      .where(eq(consultantWhatsappConfig.id, agentConfigId))
      .limit(1);

    if (agentConfig) {
      appointmentDuration = agentConfig.availabilityAppointmentDuration || 60;
      bufferBefore = agentConfig.availabilityBufferBefore || 15;
      bufferAfter = agentConfig.availabilityBufferAfter || 15;
      minHoursNotice = agentConfig.availabilityMinHoursNotice || 24;
      maxDaysAhead = agentConfig.availabilityMaxDaysAhead || 30;
      timezone = agentConfig.availabilityTimezone || "Europe/Rome";
      if (agentConfig.availabilityWorkingHours && typeof agentConfig.availabilityWorkingHours === 'object') {
        rawAvailabilityData = agentConfig.availabilityWorkingHours as Record<string, any>;
      }
      console.log(`🤖 [SLOTS] Using AGENT config (${agentConfigId.slice(0, 8)}): duration=${appointmentDuration}, timezone=${timezone}, calendarEmail=${agentConfig.googleCalendarEmail || 'N/A'}, calendarId=${agentConfig.googleCalendarId || 'primary'}`);
    } else {
      console.log(`⚠️ [SLOTS] Agent config ${agentConfigId} not found, falling back to consultant settings`);
    }
  }

  if (!rawAvailabilityData) {
    const [consultantSettings] = await db
      .select()
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
      .limit(1);

    settings = consultantSettings;

    if (!agentConfigId && settings) {
      appointmentDuration = settings.appointmentDuration || 60;
      bufferBefore = settings.bufferBefore || 15;
      bufferAfter = settings.bufferAfter || 15;
      minHoursNotice = settings.minHoursNotice || 24;
      maxDaysAhead = settings.maxDaysAhead || 30;
      timezone = settings.timezone || "Europe/Rome";
    }

    if (settings?.morningSlotStart) defaultMorningStart = settings.morningSlotStart;
    if (settings?.morningSlotEnd) defaultMorningEnd = settings.morningSlotEnd;
    if (settings?.afternoonSlotStart) defaultAfternoonStart = settings.afternoonSlotStart;
    if (settings?.afternoonSlotEnd) defaultAfternoonEnd = settings.afternoonSlotEnd;

    if (settings?.appointmentAvailability && typeof settings.appointmentAvailability === 'object') {
      rawAvailabilityData = settings.appointmentAvailability as Record<string, any>;
    }
  }

  const availabilityConfig: Record<string, DayAvailability> = {};

  const parseNamedDaysToConfig = (workingDays: Record<string, any>) => {
    for (const [dayName, dayConfig] of Object.entries(workingDays)) {
      const dayNum = dayNameToNumber[dayName.toLowerCase()];
      if (dayNum === undefined || !dayConfig || typeof dayConfig !== 'object') continue;

      if ('ranges' in dayConfig && Array.isArray(dayConfig.ranges) && dayConfig.ranges.length > 0) {
        availabilityConfig[dayNum] = {
          enabled: !!dayConfig.enabled,
          slots: dayConfig.ranges.map((r: any) => ({ start: r.start || "09:00", end: r.end || "18:00" }))
        };
      } else if ('start' in dayConfig && 'end' in dayConfig) {
        availabilityConfig[dayNum] = {
          enabled: !!dayConfig.enabled,
          slots: [{ start: dayConfig.start, end: dayConfig.end }]
        };
      } else {
        availabilityConfig[dayNum] = {
          enabled: !!dayConfig.enabled,
          slots: dayConfig.enabled
            ? [{ start: defaultMorningStart, end: defaultMorningEnd }, { start: defaultAfternoonStart, end: defaultAfternoonEnd }]
            : [{ start: "09:00", end: "18:00" }]
        };
      }
    }
  };

  if (rawAvailabilityData) {
    if ('workingDays' in rawAvailabilityData && typeof rawAvailabilityData.workingDays === 'object') {
      parseNamedDaysToConfig(rawAvailabilityData.workingDays as Record<string, any>);
      if (rawAvailabilityData.morningSlot && typeof rawAvailabilityData.morningSlot === 'object') {
        defaultMorningStart = rawAvailabilityData.morningSlot.start || defaultMorningStart;
        defaultMorningEnd = rawAvailabilityData.morningSlot.end || defaultMorningEnd;
      }
      if (rawAvailabilityData.afternoonSlot && typeof rawAvailabilityData.afternoonSlot === 'object') {
        defaultAfternoonStart = rawAvailabilityData.afternoonSlot.start || defaultAfternoonStart;
        defaultAfternoonEnd = rawAvailabilityData.afternoonSlot.end || defaultAfternoonEnd;
      }
    } else {
      const hasNamedDayKeys = Object.keys(rawAvailabilityData).some(k => dayNameToNumber[k.toLowerCase()] !== undefined);
      if (hasNamedDayKeys) {
        parseNamedDaysToConfig(rawAvailabilityData);
      } else {
        for (const [dayId, config] of Object.entries(rawAvailabilityData)) {
          if (!/^\d$/.test(dayId)) continue;
          if (config && typeof config === 'object' && 'enabled' in config) {
            if ('slots' in config && Array.isArray(config.slots)) {
              availabilityConfig[dayId] = config as DayAvailability;
            } else if ('start' in config && 'end' in config) {
              availabilityConfig[dayId] = {
                enabled: config.enabled,
                slots: [{ start: config.start, end: config.end }]
              };
            } else if (config.enabled) {
              availabilityConfig[dayId] = {
                enabled: true,
                slots: [
                  { start: defaultMorningStart, end: defaultMorningEnd },
                  { start: defaultAfternoonStart, end: defaultAfternoonEnd }
                ]
              };
            } else {
              availabilityConfig[dayId] = {
                enabled: false,
                slots: [{ start: "09:00", end: "18:00" }]
              };
            }
          }
        }
      }
    }
  }

  if (Object.keys(availabilityConfig).length === 0) {
    for (let d = 1; d <= 5; d++) {
      availabilityConfig[d.toString()] = { 
        enabled: true, 
        slots: [
          { start: defaultMorningStart, end: defaultMorningEnd },
          { start: defaultAfternoonStart, end: defaultAfternoonEnd }
        ]
      };
    }
    availabilityConfig["0"] = { enabled: false, slots: [{ start: "09:00", end: "18:00" }] };
    availabilityConfig["6"] = { enabled: false, slots: [{ start: "09:00", end: "18:00" }] };
  }

  // Calculate date range
  const minStartTime = new Date(now.getTime() + minHoursNotice * 60 * 60 * 1000);
  const startDate = args.startDate ? new Date(args.startDate) : minStartTime;
  const maxEndDate = new Date(now.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000);
  const endDate = args.endDate ? new Date(args.endDate) : maxEndDate;
  
  // Clamp dates
  const effectiveStartDate = startDate < minStartTime ? minStartTime : startDate;
  const effectiveEndDate = endDate > maxEndDate ? maxEndDate : endDate;

  // Get existing consultations
  const existingConsultations = await db
    .select({
      scheduledAt: consultations.scheduledAt,
      duration: consultations.duration
    })
    .from(consultations)
    .where(
      and(
        eq(consultations.consultantId, consultantId),
        gte(consultations.scheduledAt, effectiveStartDate),
        lte(consultations.scheduledAt, effectiveEndDate),
        or(
          eq(consultations.status, "scheduled"),
          eq(consultations.status, "completed")
        )
      )
    );

  // Build busy time ranges from consultations (with buffers)
  const busyRanges: Array<{ start: Date; end: Date }> = existingConsultations.map(c => {
    const consultStart = new Date(c.scheduledAt);
    const consultEnd = new Date(consultStart.getTime() + (c.duration || 60) * 60 * 1000);
    return {
      start: new Date(consultStart.getTime() - bufferBefore * 60 * 1000),
      end: new Date(consultEnd.getTime() + bufferAfter * 60 * 1000)
    };
  });

  // Get pending bookings (slots awaiting confirmation) - exclude from available slots
  // Filter by date range and not expired
  const pendingBookingsData = await db
    .select({
      startAt: pendingBookings.startAt,
      duration: pendingBookings.duration
    })
    .from(pendingBookings)
    .where(
      and(
        eq(pendingBookings.consultantId, consultantId),
        eq(pendingBookings.status, "awaiting_confirm"),
        gte(pendingBookings.expiresAt, now),
        gte(pendingBookings.startAt, effectiveStartDate),
        lte(pendingBookings.startAt, effectiveEndDate)
      )
    );

  // Add pending bookings to busy ranges
  const pendingBusyRanges = pendingBookingsData.map(p => {
    const pendingStart = new Date(p.startAt);
    const pendingEnd = new Date(pendingStart.getTime() + (p.duration || 60) * 60 * 1000);
    return {
      start: new Date(pendingStart.getTime() - bufferBefore * 60 * 1000),
      end: new Date(pendingEnd.getTime() + bufferAfter * 60 * 1000)
    };
  });
  
  console.log(`🔒 [SLOTS] Found ${pendingBookingsData.length} pending bookings to exclude`);

  // Try to get Google Calendar events if connected (using listEvents for proper filtering)
  let calendarBusy: Array<{ start: Date; end: Date }> = [];
  try {
    const { listEvents } = await import("../google-calendar-service");
    const calendarEvents = await listEvents(consultantId, effectiveStartDate, effectiveEndDate, agentConfigId);
    for (const event of calendarEvents) {
      calendarBusy.push({
        start: event.start,
        end: event.end
      });
    }
    console.log(`📅 [SLOTS] Loaded ${calendarBusy.length} events from Google Calendar (filtered: transparent/free excluded)`);
  } catch (error) {
    try {
      const accessToken = await getValidAccessToken(consultantId);
      if (accessToken) {
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const calendarEvents = await calendar.events.list({
          calendarId: 'primary',
          timeMin: effectiveStartDate.toISOString(),
          timeMax: effectiveEndDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        if (calendarEvents.data.items) {
          for (const event of calendarEvents.data.items) {
            if (event.start?.dateTime && event.end?.dateTime) {
              if (event.transparency === 'transparent') continue;
              calendarBusy.push({
                start: new Date(event.start.dateTime),
                end: new Date(event.end.dateTime)
              });
            }
          }
        }
        console.log(`📅 [SLOTS] Loaded ${calendarBusy.length} events from Google Calendar (fallback API)`);
      }
    } catch (fallbackError) {
      console.log(`⚠️ [SLOTS] Could not load Google Calendar (not connected or error):`, fallbackError);
    }
  }

  // Merge all busy ranges (consultations + pending bookings + calendar)
  const allBusyRanges = [...busyRanges, ...pendingBusyRanges, ...calendarBusy];

  // Helper to check if a slot conflicts with busy ranges
  const isSlotBusy = (slotStart: Date, slotEnd: Date): { busy: boolean; reason?: string } => {
    for (const busy of allBusyRanges) {
      if (slotStart < busy.end && slotEnd > busy.start) {
        return { busy: true, reason: `conflict ${busy.start.toISOString().slice(11,16)}-${busy.end.toISOString().slice(11,16)}` };
      }
    }
    return { busy: false };
  };

  const workingHours = {
    mattina: { start: 9, end: 12 },
    pomeriggio: { start: 14, end: 18 },
    sera: { start: 18, end: 20 }
  };

  const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

  const availableSlots: Array<{
    date: string;
    dayOfWeek: string;
    time: string;
    dateFormatted: string;
    duration: number;
  }> = [];

  // Timezone helper - convert consultant local time to UTC for comparison
  const getTimezoneOffset = (date: Date, tz: string): number => {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
      return (utcDate.getTime() - tzDate.getTime()) / (60 * 1000);
    } catch {
      return -60;
    }
  };

  const current = new Date(effectiveStartDate);
  current.setHours(0, 0, 0, 0);

  let totalCandidates = 0;
  let blockedByBusy = 0;
  let blockedByFuture = 0;
  const blockedDetails: string[] = [];

  while (current <= effectiveEndDate && availableSlots.length < 20) {
    const dayOfWeek = current.getDay();
    const dayName = dayNames[dayOfWeek];
    const dayConfig = availabilityConfig[dayOfWeek.toString()];

    if (dayConfig?.enabled) {
      if (!args.preferredDayOfWeek || args.preferredDayOfWeek.toLowerCase() === dayName) {
        for (const timeSlot of dayConfig.slots) {
          const [startHour, startMin] = (timeSlot.start || "09:00").split(':').map(Number);
          const [endHour, endMin] = (timeSlot.end || "18:00").split(':').map(Number);
          
          let slotStartHour = startHour;
          let slotStartMin = startMin;
          
          if (args.preferredTimeRange) {
            const range = workingHours[args.preferredTimeRange as keyof typeof workingHours];
            if (range) {
              slotStartHour = Math.max(slotStartHour, range.start);
            }
          }

          while (slotStartHour < endHour || (slotStartHour === endHour && slotStartMin < endMin)) {
            totalCandidates++;
            
            const dateStr = current.toISOString().slice(0, 10);
            const timeStr = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}:00`;
            const localSlotStart = new Date(`${dateStr}T${timeStr}`);
            const tzOffset = getTimezoneOffset(localSlotStart, timezone);
            const slotStart = new Date(localSlotStart.getTime() + tzOffset * 60 * 1000);
            
            const slotEnd = new Date(slotStart.getTime() + appointmentDuration * 60 * 1000);
            
            const slotEndLocalHour = slotStartHour + Math.floor((slotStartMin + appointmentDuration) / 60);
            const slotEndLocalMin = (slotStartMin + appointmentDuration) % 60;
            if (slotEndLocalHour > endHour || (slotEndLocalHour === endHour && slotEndLocalMin > endMin)) {
              break;
            }
            
            if (slotStart > minStartTime) {
              const bufferedStart = new Date(slotStart.getTime() - bufferBefore * 60 * 1000);
              const bufferedEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);
              
              const busyCheck = isSlotBusy(bufferedStart, bufferedEnd);
              if (!busyCheck.busy) {
                availableSlots.push({
                  date: dateStr,
                  dayOfWeek: dayName,
                  time: `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}`,
                  dateFormatted: slotStart.toLocaleDateString('it-IT', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  }),
                  duration: appointmentDuration
                });

                if (availableSlots.length >= 20) break;
              } else {
                blockedByBusy++;
                if (blockedDetails.length < 5) {
                  blockedDetails.push(`${dateStr} ${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')} → ${busyCheck.reason}`);
                }
              }
            } else {
              blockedByFuture++;
            }
            
            const slotIncrement = appointmentDuration <= 30 ? 30 : 60;
            slotStartMin += slotIncrement;
            if (slotStartMin >= 60) {
              slotStartHour += Math.floor(slotStartMin / 60);
              slotStartMin = slotStartMin % 60;
            }
          }
          
          if (availableSlots.length >= 20) break;
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  console.log(`\n📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 [SLOTS] DISPONIBILITÀ DEBUG - Consultant ${consultantId.slice(0, 8)}${agentConfigId ? ` (Agent: ${agentConfigId.slice(0, 8)})` : ''}`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   Range: ${effectiveStartDate.toISOString().slice(0, 10)} → ${effectiveEndDate.toISOString().slice(0, 10)}`);
  console.log(`   Durata consulenza: ${appointmentDuration}min | Buffer: ${bufferBefore}min/${bufferAfter}min | Preavviso: ${minHoursNotice}h`);
  console.log(`   Giorni attivi: ${Object.entries(availabilityConfig).filter(([_, c]) => c.enabled).map(([d, c]) => `${dayNames[parseInt(d)] || `day${d}`}(${c.slots.map(s => `${s.start}-${s.end}`).join(',')})`).join(', ') || 'nessuno'}`);
  console.log(`   Tutti i giorni: ${Object.entries(availabilityConfig).map(([d, c]) => `${dayNames[parseInt(d)] || `day${d}`}:${c.enabled ? '✅' : '❌'}`).join(', ')}`);
  console.log(`   ─────────────────────────────────────────────────────`);
  console.log(`   Consulenze DB occupate: ${existingConsultations.length}`);
  console.log(`   Prenotazioni pendenti: ${pendingBookingsData.length}`);
  console.log(`   Eventi Google Calendar: ${calendarBusy.length}`);
  console.log(`   Totale fasce busy: ${allBusyRanges.length}`);
  console.log(`   ─────────────────────────────────────────────────────`);
  console.log(`   Slot candidati generati: ${totalCandidates}`);
  console.log(`   Bloccati (troppo vicini): ${blockedByFuture}`);
  console.log(`   Bloccati (occupati): ${blockedByBusy}`);
  console.log(`   ✅ SLOT DISPONIBILI: ${availableSlots.length}`);
  if (blockedDetails.length > 0) {
    console.log(`   Esempi bloccati:`);
    blockedDetails.forEach(d => console.log(`     ❌ ${d}`));
  }
  if (availableSlots.length > 0) {
    console.log(`   Primi slot liberi:`);
    availableSlots.slice(0, 5).forEach(s => console.log(`     ✅ ${s.date} ${s.time} (${s.dayOfWeek})`));
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const calendarConnected = !!(settings?.googleRefreshToken);
  
  // Set flow state to awaiting_slot_selection if slots are found
  if (availableSlots.length > 0 && conversationId) {
    await setBookingFlowState(conversationId, "awaiting_slot_selection");
  }
  
  return {
    toolName: "getAvailableSlots",
    args,
    result: {
      slots: availableSlots,
      count: availableSlots.length,
      duration: appointmentDuration,
      calendarConnected,
      message: availableSlots.length > 0
        ? `Ho trovato ${availableSlots.length} slot disponibili (consulenze di ${appointmentDuration} minuti). Ecco i primi:`
        : "Non ho trovato slot disponibili nel periodo richiesto.",
      next_action_hint: availableSlots.length > 0 
        ? "Chiedi al cliente quale slot preferisce, poi usa proposeBooking"
        : "Prova a cercare in un periodo diverso o contatta il consulente"
    },
    success: true
  };
}

async function executeProposeBooking(
  clientId: string,
  consultantId: string,
  args: { date: string; time: string; duration?: number; notes?: string },
  conversationId?: string | null
): Promise<ConsultationToolResult> {
  // Guardrail: validate required parameters
  if (!args.date) {
    return {
      toolName: "proposeBooking",
      args,
      result: { 
        error_code: "MISSING_DATE",
        message: "Data obbligatoria non fornita",
        suggestion: "Chiedi all'utente quale data preferisce per la consulenza"
      },
      success: false,
      error: "Data non specificata"
    };
  }
  
  if (!args.time) {
    return {
      toolName: "proposeBooking",
      args,
      result: { 
        error_code: "MISSING_TIME",
        message: "Orario obbligatorio non fornito",
        suggestion: "Chiedi all'utente quale orario preferisce per la consulenza"
      },
      success: false,
      error: "Orario non specificato"
    };
  }
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(args.date)) {
    return {
      toolName: "proposeBooking",
      args,
      result: { 
        error_code: "INVALID_DATE_FORMAT",
        message: "Formato data non valido",
        suggestion: "La data deve essere nel formato YYYY-MM-DD (es: 2026-02-15)"
      },
      success: false,
      error: "Formato data non valido"
    };
  }
  
  const [clientData] = await db
    .select({ monthlyLimit: users.monthlyConsultationLimit })
    .from(users)
    .where(eq(users.id, clientId));

  if (clientData?.monthlyLimit) {
    const now = new Date();
    const proposedDate = new Date(args.date);
    const startOfMonth = new Date(proposedDate.getFullYear(), proposedDate.getMonth(), 1);
    const endOfMonth = new Date(proposedDate.getFullYear(), proposedDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const existingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(consultations)
      .where(
        and(
          eq(consultations.clientId, clientId),
          gte(consultations.scheduledAt, startOfMonth),
          lte(consultations.scheduledAt, endOfMonth),
          or(
            eq(consultations.status, "completed"),
            eq(consultations.status, "scheduled")
          )
        )
      );

    const currentCount = Number(existingCount[0]?.count || 0);
    if (currentCount >= clientData.monthlyLimit) {
      return {
        toolName: "proposeBooking",
        args,
        result: {
          canBook: false,
          reason: `Hai già raggiunto il limite di ${clientData.monthlyLimit} consulenze per questo mese. Non puoi prenotare altre consulenze.`
        },
        success: true
      };
    }
  }

  const proposedDateTime = new Date(`${args.date}T${args.time}:00`);
  const existingAtTime = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(
      and(
        eq(consultations.consultantId, consultantId),
        eq(consultations.scheduledAt, proposedDateTime),
        or(
          eq(consultations.status, "scheduled"),
          eq(consultations.status, "completed")
        )
      )
    );

  if (existingAtTime.length > 0) {
    return {
      toolName: "proposeBooking",
      args,
      result: {
        canBook: false,
        reason: "Questo slot è già occupato. Scegli un altro orario."
      },
      success: true
    };
  }

  // Check for existing pending booking on same slot
  const existingPending = await db
    .select({ token: pendingBookings.token })
    .from(pendingBookings)
    .where(
      and(
        eq(pendingBookings.consultantId, consultantId),
        eq(pendingBookings.startAt, proposedDateTime),
        eq(pendingBookings.status, "awaiting_confirm")
      )
    );

  if (existingPending.length > 0) {
    return {
      toolName: "proposeBooking",
      args,
      result: {
        canBook: false,
        reason: "Questo slot ha già una prenotazione in attesa di conferma. Riprova tra qualche minuto o scegli un altro orario."
      },
      success: true
    };
  }

  // Generate token and insert into pending_bookings table
  const confirmationToken = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate any previous pending bookings for this conversation to prevent "sticky tool mode"
  // This happens when user changes their mind (e.g., "actually make it 10:00 instead of 09:00")
  if (conversationId) {
    const supersededCount = await db
      .update(pendingBookings)
      .set({ status: "superseded" })
      .where(
        and(
          eq(pendingBookings.conversationId, conversationId),
          eq(pendingBookings.status, "awaiting_confirm")
        )
      );
    console.log(`🧹 [PENDING BOOKING] Superseded previous pending bookings for conversation ${conversationId.slice(0, 8)}...`);
  }

  await db.insert(pendingBookings).values({
    token: confirmationToken,
    clientId,
    consultantId,
    startAt: proposedDateTime,
    duration: args.duration || 60,
    status: "awaiting_confirm",
    conversationId: conversationId ?? null,
    notes: args.notes,
    expiresAt,
  });
  
  console.log(`🎫 [PENDING BOOKING] Created pending booking with token ${confirmationToken.slice(0, 8)}... for conversation ${conversationId || 'unknown'}`);

  // Set flow state to awaiting_confirm
  if (conversationId) {
    await setBookingFlowState(conversationId, "awaiting_confirm");
  }

  return {
    toolName: "proposeBooking",
    args,
    result: {
      canBook: true,
      confirmationToken,
      proposal: {
        date: proposedDateTime.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        time: args.time,
        duration: args.duration || 60
      },
      message: `Ho preparato la prenotazione per ${proposedDateTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${args.time}. Rispondi "confermo" o "sì" per procedere.`,
      confirmationMethod: "chat_reply",
      instructions: "L'utente deve rispondere in chat per confermare (es. 'confermo', 'sì', 'ok'). NON menzionare pulsanti o link di conferma.",
      expiresIn: "10 minuti"
    },
    success: true
  };
}

async function executeConfirmBooking(
  clientId: string,
  args: { confirmationToken?: string; conversationId?: string },
  serverConversationId?: string | null
): Promise<ConsultationToolResult> {
  // Use server-side conversationId as fallback if not in args
  const effectiveConversationId = args.conversationId || serverConversationId;
  
  // Guardrail: validate that at least one identifier is provided
  if (!args.confirmationToken && !effectiveConversationId) {
    return {
      toolName: "confirmBooking",
      args,
      result: { 
        error_code: "MISSING_TOKEN",
        message: "Token di conferma obbligatorio non fornito",
        suggestion: "Prima devi proporre una prenotazione con proposeBooking per ottenere un token"
      },
      success: false,
      error: "Token non specificato"
    };
  }
  
  // Query pending booking from database
  let pendingBooking;

  if (args.confirmationToken) {
    const [booking] = await db
      .select()
      .from(pendingBookings)
      .where(eq(pendingBookings.token, args.confirmationToken))
      .limit(1);
    pendingBooking = booking;
  } else if (effectiveConversationId) {
    console.log(`🔍 [CONFIRM BOOKING] Looking up by conversationId: ${effectiveConversationId}`);
    const [booking] = await db
      .select()
      .from(pendingBookings)
      .where(
        and(
          or(
            eq(pendingBookings.conversationId, effectiveConversationId),
            eq(pendingBookings.publicConversationId, effectiveConversationId)
          ),
          eq(pendingBookings.status, "awaiting_confirm"),
          sql`${pendingBookings.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(pendingBookings.createdAt))
      .limit(1);
    pendingBooking = booking;
    console.log(`🔍 [CONFIRM BOOKING] Found booking by conversationId: ${booking ? 'yes' : 'no'}`);
  }

  if (!pendingBooking) {
    return {
      toolName: "confirmBooking",
      args,
      result: {
        success: false,
        reason: "Il token di conferma non è valido o è scaduto. Richiedi una nuova proposta di prenotazione."
      },
      success: true
    };
  }

  // Handle idempotency - check if already confirmed with consultationId
  if (pendingBooking.status === "confirmed" && pendingBooking.consultationId) {
    const [existingConsultation] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, pendingBooking.consultationId));

    if (existingConsultation) {
      const timeStr = new Date(pendingBooking.startAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const formattedDate = new Date(pendingBooking.startAt).toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      return {
        toolName: "confirmBooking",
        args,
        result: {
          success: true,
          consultation: {
            id: existingConsultation.id,
            date: new Date(pendingBooking.startAt).toLocaleDateString('it-IT', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            }),
            time: timeStr,
            duration: pendingBooking.duration,
            googleMeetLink: existingConsultation.googleMeetLink || null,
            calendarEventCreated: !!existingConsultation.googleCalendarEventId
          },
          message: `La consulenza è già confermata per ${formattedDate} alle ${timeStr}.`,
          next_action_hint: "La consulenza è già confermata."
        },
        success: true
      };
    }
  }

  if (pendingBooking.clientId !== clientId) {
    return {
      toolName: "confirmBooking",
      args,
      result: {
        success: false,
        reason: "Questa prenotazione non appartiene al tuo account."
      },
      success: true
    };
  }

  // Check expiry and mark as expired in DB if needed
  if (pendingBooking.expiresAt < new Date()) {
    await db.update(pendingBookings)
      .set({ status: "expired" })
      .where(eq(pendingBookings.token, pendingBooking.token));
    return {
      toolName: "confirmBooking",
      args,
      result: {
        success: false,
        reason: "La proposta di prenotazione è scaduta. Richiedi una nuova proposta."
      },
      success: true
    };
  }

  // Atomic UPDATE for confirming (returns affected rows)
  const updateResult = await db
    .update(pendingBookings)
    .set({
      status: "confirmed",
      confirmedAt: new Date()
    })
    .where(
      and(
        eq(pendingBookings.token, pendingBooking.token),
        eq(pendingBookings.status, "awaiting_confirm"),
        sql`${pendingBookings.expiresAt} > NOW()`
      )
    )
    .returning();

  if (updateResult.length === 0) {
    return {
      toolName: "confirmBooking",
      args,
      result: {
        success: false,
        reason: "La prenotazione è già stata confermata o è scaduta. Richiedi una nuova proposta se necessario."
      },
      success: true
    };
  }

  const scheduledAt = new Date(pendingBooking.startAt);
  const timeStr = scheduledAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const dateStr = scheduledAt.toISOString().split('T')[0];

  // Insert consultation with unique constraint handling
  let newConsultation;
  try {
    const [consultation] = await db
      .insert(consultations)
      .values({
        consultantId: pendingBooking.consultantId,
        clientId: pendingBooking.clientId,
        scheduledAt,
        duration: pendingBooking.duration,
        notes: pendingBooking.notes || "Prenotata tramite AI Assistant",
        status: "scheduled"
      })
      .returning();
    newConsultation = consultation;

    // Save consultationId for idempotency
    await db.update(pendingBookings)
      .set({ consultationId: newConsultation.id })
      .where(eq(pendingBookings.token, pendingBooking.token));

  } catch (error: any) {
    if (error.code === '23505') {
      // Unique constraint violation - slot already taken
      await db.update(pendingBookings)
        .set({ status: "cancelled" })
        .where(eq(pendingBookings.token, pendingBooking.token));
      return {
        toolName: "confirmBooking",
        args,
        result: {
          error_code: "SLOT_TAKEN",
          message: "Lo slot è stato appena prenotato da un altro utente",
          suggestion: "Scegli un altro orario disponibile"
        },
        success: false,
        error: "Slot già occupato"
      };
    }
    throw error;
  }

  console.log(`✅ [CONSULTATION TOOL] Booking confirmed: ${newConsultation.id}`);

  // Try to create Google Calendar event with Meet link
  let googleMeetLink: string | undefined;
  let googleEventId: string | undefined;
  let calendarCreated = false;

  try {
    // Get consultant availability settings
    const [settings] = await db
      .select({
        googleRefreshToken: consultantAvailabilitySettings.googleRefreshToken,
        timezone: consultantAvailabilitySettings.timezone
      })
      .from(consultantAvailabilitySettings)
      .where(eq(consultantAvailabilitySettings.consultantId, pendingBooking.consultantId))
      .limit(1);

    if (settings?.googleRefreshToken) {
      // Get client and consultant info for the calendar event
      const [clientInfo] = await db
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName
        })
        .from(users)
        .where(eq(users.id, pendingBooking.clientId))
        .limit(1);

      const [consultantInfo] = await db
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName
        })
        .from(users)
        .where(eq(users.id, pendingBooking.consultantId))
        .limit(1);

      const clientName = clientInfo ? `${clientInfo.firstName || ''} ${clientInfo.lastName || ''}`.trim() : 'Cliente';
      const attendees = [clientInfo?.email, consultantInfo?.email].filter(Boolean) as string[];

      console.log(`📅 [CONSULTATION TOOL] Creating Google Calendar event for consultation ${newConsultation.id}...`);

      const calendarResult = await createGoogleCalendarEvent(
        pendingBooking.consultantId,
        {
          summary: `Consulenza con ${clientName}`,
          description: `Consulenza prenotata tramite AI Assistant.\n\nNote: ${pendingBooking.notes || 'Nessuna nota'}`,
          startDate: dateStr,
          startTime: timeStr,
          duration: pendingBooking.duration,
          timezone: settings.timezone || "Europe/Rome",
          attendees
        }
      );

      googleEventId = calendarResult.googleEventId;
      googleMeetLink = calendarResult.googleMeetLink;
      calendarCreated = true;

      // Update consultation with Calendar info
      await db
        .update(consultations)
        .set({
          googleCalendarEventId: googleEventId,
          googleMeetLink: googleMeetLink || null
        })
        .where(eq(consultations.id, newConsultation.id));

      console.log(`✅ [CONSULTATION TOOL] Calendar event created with Meet link: ${googleMeetLink}`);
    } else {
      console.log(`⚠️ [CONSULTATION TOOL] Google Calendar not connected for consultant ${pendingBooking.consultantId}`);
    }
  } catch (calendarError: any) {
    console.error(`❌ [CONSULTATION TOOL] Failed to create Calendar event:`, calendarError.message);
    // Continue without Calendar - consultation is still created
  }

  const formattedDate = scheduledAt.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  let message = `Perfetto! Ho confermato la tua consulenza per ${formattedDate} alle ${timeStr}.`;
  if (googleMeetLink) {
    message += ` Ti ho inviato l'invito al calendario con il link per la videochiamata.`;
  } else {
    message += ` Riceverai presto i dettagli per la videochiamata.`;
  }

  // Set post-booking context: allows user to modify/cancel within 30 min window
  if (serverConversationId) {
    await setPostBookingContext(serverConversationId, newConsultation.id);
    console.log(`📌 [CONSULTATION TOOL] Post-booking context set for consultation ${newConsultation.id}`);
  }

  return {
    toolName: "confirmBooking",
    args,
    result: {
      success: true,
      consultation: {
        id: newConsultation.id,
        date: scheduledAt.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        time: timeStr,
        duration: pendingBooking.duration,
        googleMeetLink: googleMeetLink || null,
        calendarEventCreated: calendarCreated
      },
      message,
      next_action_hint: "La consulenza è confermata. L'utente riceverà email di conferma."
    },
    success: true
  };
}

async function executeCancelBooking(
  clientId: string,
  consultantId: string,
  args: { date?: string; consultationId?: string },
  conversationId?: string | null
): Promise<ConsultationToolResult> {
  console.log(`🗑️ [CANCEL BOOKING] Looking for consultation to cancel for client ${clientId.slice(0, 8)}`);
  console.log(`   Args: date=${args.date}, consultationId=${args.consultationId}, conversationId=${conversationId || 'none'}`);

  // Validate that at least one identifier is provided
  if (!args.date && !args.consultationId) {
    return {
      toolName: "cancelBooking",
      args,
      result: {
        error_code: "MISSING_IDENTIFIER",
        message: "Devi specificare una data o un ID della consulenza da cancellare",
        suggestion: "Chiedi al cliente quale consulenza vuole cancellare (data o riferimento)"
      },
      success: false,
      error: "Nessun identificatore fornito"
    };
  }

  // Find the consultation
  let consultation;

  if (args.consultationId) {
    // Search by ID
    const [found] = await db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.id, args.consultationId),
          eq(consultations.clientId, clientId)
        )
      )
      .limit(1);
    consultation = found;
  } else if (args.date) {
    // Search by date - find consultations for the given date
    const targetDate = new Date(args.date);
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const [found] = await db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.clientId, clientId),
          gte(consultations.scheduledAt, startOfDay),
          lte(consultations.scheduledAt, endOfDay),
          or(
            eq(consultations.status, "scheduled"),
            eq(consultations.status, "pending")
          )
        )
      )
      .orderBy(consultations.scheduledAt)
      .limit(1);
    consultation = found;
  }

  if (!consultation) {
    return {
      toolName: "cancelBooking",
      args,
      result: {
        cancelled: false,
        reason: args.date 
          ? `Non ho trovato nessuna consulenza prenotata per il ${new Date(args.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}.`
          : "Non ho trovato la consulenza specificata.",
        suggestion: "Usa getConsultationStatus per vedere le consulenze prenotate"
      },
      success: true
    };
  }

  // Check if the consultation can be cancelled (only scheduled or pending)
  if (consultation.status !== "scheduled" && consultation.status !== "pending") {
    return {
      toolName: "cancelBooking",
      args,
      result: {
        cancelled: false,
        reason: `La consulenza è in stato "${consultation.status}" e non può essere cancellata.`,
        consultationStatus: consultation.status
      },
      success: true
    };
  }

  // Check if the consultation belongs to the right consultant
  if (consultation.consultantId !== consultantId) {
    return {
      toolName: "cancelBooking",
      args,
      result: {
        cancelled: false,
        reason: "Questa consulenza non appartiene al tuo consulente."
      },
      success: true
    };
  }

  const scheduledAt = new Date(consultation.scheduledAt);
  const formattedDate = scheduledAt.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const timeStr = scheduledAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Update the consultation status to 'cancelled'
  await db
    .update(consultations)
    .set({
      status: "cancelled",
      updatedAt: new Date()
    })
    .where(eq(consultations.id, consultation.id));

  console.log(`✅ [CANCEL BOOKING] Consultation ${consultation.id} cancelled`);

  // Clear booking flow state and post-booking context if conversationId exists
  if (conversationId) {
    try {
      await clearBookingFlowState(conversationId);
      await clearPostBookingContext(conversationId);
      console.log(`🧹 [CANCEL BOOKING] Cleared booking flow state and post-booking context for conversation ${conversationId.slice(0, 8)}`);
    } catch (flowError) {
      console.warn(`⚠️ [CANCEL BOOKING] Failed to clear flow/post-booking state:`, flowError);
    }
  }

  // Try to delete Google Calendar event if it exists
  let calendarEventDeleted = false;
  if (consultation.googleCalendarEventId) {
    try {
      console.log(`📅 [CANCEL BOOKING] Deleting Google Calendar event ${consultation.googleCalendarEventId}...`);
      await deleteGoogleCalendarEvent(consultantId, consultation.googleCalendarEventId);
      calendarEventDeleted = true;
      console.log(`✅ [CANCEL BOOKING] Google Calendar event deleted`);
    } catch (calendarError: any) {
      console.error(`❌ [CANCEL BOOKING] Failed to delete Calendar event:`, calendarError.message);
      // Continue even if calendar deletion fails - the consultation is cancelled
    }
  }

  return {
    toolName: "cancelBooking",
    args,
    result: {
      cancelled: true,
      consultation: {
        id: consultation.id,
        date: formattedDate,
        time: timeStr,
        duration: consultation.duration
      },
      calendarEventDeleted,
      message: `Ho cancellato la consulenza del ${formattedDate} alle ${timeStr}.${calendarEventDeleted ? ' L\'evento è stato rimosso anche dal calendario.' : ''}`,
      next_action_hint: "offer_rebooking"
    },
    success: true
  };
}

/**
 * Reschedule an existing consultation to a new date/time
 * This doesn't count against monthly limits - it's a modification, not a new booking
 */
async function executeRescheduleBooking(
  clientId: string,
  consultantId: string,
  args: { originalDate?: string; newDate: string; newTime: string; consultationId?: string },
  conversationId?: string | null
): Promise<ConsultationToolResult> {
  console.log(`📅 [RESCHEDULE BOOKING] Attempting to reschedule for client ${clientId.slice(0, 8)}`);
  console.log(`   Args:`, JSON.stringify(args));

  // Validate required parameters
  if (!args.newDate || !args.newTime) {
    return {
      toolName: "rescheduleBooking",
      args,
      result: {
        error_code: "MISSING_PARAMETERS",
        message: "Data e ora del nuovo appuntamento sono obbligatorie",
        suggestion: "Chiedi al cliente quale data e ora preferisce per spostare l'appuntamento"
      },
      success: false,
      error: "Parametri mancanti"
    };
  }

  // Find the existing consultation to reschedule
  let consultation: any = null;

  if (args.consultationId) {
    // Direct lookup by ID
    const [found] = await db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.id, args.consultationId),
          eq(consultations.clientId, clientId),
          eq(consultations.status, "scheduled")
        )
      )
      .limit(1);
    consultation = found;
  } else if (args.originalDate) {
    // Find by original date
    const startOfDay = new Date(args.originalDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(args.originalDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [found] = await db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.clientId, clientId),
          eq(consultations.status, "scheduled"),
          sql`${consultations.scheduledAt} >= ${startOfDay.toISOString()}`,
          sql`${consultations.scheduledAt} <= ${endOfDay.toISOString()}`
        )
      )
      .limit(1);
    consultation = found;
  } else {
    // Find the most recent upcoming consultation for this client
    const now = new Date();
    const [found] = await db
      .select()
      .from(consultations)
      .where(
        and(
          eq(consultations.clientId, clientId),
          eq(consultations.status, "scheduled"),
          sql`${consultations.scheduledAt} >= ${now.toISOString()}`
        )
      )
      .orderBy(consultations.scheduledAt)
      .limit(1);
    consultation = found;
  }

  if (!consultation) {
    return {
      toolName: "rescheduleBooking",
      args,
      result: {
        error_code: "CONSULTATION_NOT_FOUND",
        message: "Non ho trovato nessuna consulenza da riprogrammare",
        suggestion: args.originalDate 
          ? `Non c'è nessuna consulenza programmata per ${args.originalDate}. Verifica la data corretta.`
          : "Non hai consulenze programmate da spostare."
      },
      success: true
    };
  }

  const originalScheduledAt = new Date(consultation.scheduledAt);
  const originalFormattedDate = originalScheduledAt.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  const originalTimeStr = originalScheduledAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Parse new date/time with proper timezone handling (Europe/Rome)
  // Use the same timezone conversion as the booking flow
  const localTimeToUtc = (date: Date, timeStr: string, tz: string): Date => {
    const [hour, min] = timeStr.split(':').map(Number);
    if (isNaN(hour) || isNaN(min)) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    const dateStr = date.toISOString().slice(0, 10);
    const localStr = `${dateStr}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;
    const localDate = new Date(localStr);
    
    try {
      const utcDate = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(localDate.toLocaleString('en-US', { timeZone: tz }));
      const offsetMinutes = (utcDate.getTime() - tzDate.getTime()) / (60 * 1000);
      return new Date(localDate.getTime() + offsetMinutes * 60 * 1000);
    } catch {
      // Default to Europe/Rome winter time (UTC+1)
      return new Date(localDate.getTime() - 60 * 60 * 1000);
    }
  };

  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(args.newTime)) {
    return {
      toolName: "rescheduleBooking",
      args,
      result: {
        error_code: "INVALID_TIME_FORMAT",
        message: "Formato orario non valido. Usa HH:MM (es. 11:00)",
        suggestion: "Specifica l'orario nel formato HH:MM"
      },
      success: true
    };
  }

  const newDate = new Date(args.newDate);
  const newScheduledAt = localTimeToUtc(newDate, args.newTime, 'Europe/Rome');

  // Validate new time is in the future
  const now = new Date();
  if (newScheduledAt <= now) {
    return {
      toolName: "rescheduleBooking",
      args,
      result: {
        error_code: "PAST_DATE",
        message: "Non puoi riprogrammare una consulenza nel passato",
        suggestion: "Scegli una data e ora futura"
      },
      success: true
    };
  }

  // Check if new slot is available (no other consultations at the same time)
  const slotStart = new Date(newScheduledAt);
  const slotEnd = new Date(newScheduledAt);
  slotEnd.setMinutes(slotEnd.getMinutes() + (consultation.duration || 60));

  const conflictingConsultations = await db
    .select()
    .from(consultations)
    .where(
      and(
        eq(consultations.consultantId, consultantId),
        eq(consultations.status, "scheduled"),
        // Exclude the current consultation being rescheduled
        sql`${consultations.id} != ${consultation.id}`,
        // Check for time overlap
        sql`${consultations.scheduledAt} < ${slotEnd.toISOString()}`,
        sql`${consultations.scheduledAt} + INTERVAL '1 minute' * ${consultation.duration || 60} > ${slotStart.toISOString()}`
      )
    );

  if (conflictingConsultations.length > 0) {
    return {
      toolName: "rescheduleBooking",
      args,
      result: {
        error_code: "SLOT_UNAVAILABLE",
        message: "Lo slot richiesto non è disponibile",
        suggestion: "Il consulente ha già un appuntamento in quel momento. Prova un altro orario."
      },
      success: true
    };
  }

  // Update the consultation with new date/time
  await db
    .update(consultations)
    .set({
      scheduledAt: newScheduledAt,
      updatedAt: new Date(),
      notes: consultation.notes 
        ? `${consultation.notes}\n[Riprogrammato da ${originalFormattedDate} ${originalTimeStr}]`
        : `[Riprogrammato da ${originalFormattedDate} ${originalTimeStr}]`
    })
    .where(eq(consultations.id, consultation.id));

  console.log(`✅ [RESCHEDULE BOOKING] Consultation ${consultation.id} rescheduled to ${newScheduledAt.toISOString()}`);

  // Update Google Calendar event if it exists
  let calendarUpdated = false;
  if (consultation.googleCalendarEventId) {
    try {
      console.log(`📅 [RESCHEDULE BOOKING] Updating Google Calendar event ${consultation.googleCalendarEventId}...`);
      
      // Get valid access token
      const accessToken = await getValidAccessToken(consultantId);
      if (accessToken) {
        // Fetch client info for the calendar event
        const [client] = await db.select().from(users).where(eq(users.id, clientId)).limit(1);
        const [consultant] = await db.select().from(users).where(eq(users.id, consultantId)).limit(1);
        
        const eventEndTime = new Date(newScheduledAt);
        eventEndTime.setMinutes(eventEndTime.getMinutes() + (consultation.duration || 60));

        // Update the calendar event using PATCH
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${consultation.googleCalendarEventId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              start: {
                dateTime: newScheduledAt.toISOString(),
                timeZone: 'Europe/Rome',
              },
              end: {
                dateTime: eventEndTime.toISOString(),
                timeZone: 'Europe/Rome',
              },
              summary: `Consulenza: ${client?.firstName || 'Cliente'} ${client?.lastName || ''} (riprogrammata)`,
              description: `Consulenza riprogrammata per ${client?.firstName || 'Cliente'} ${client?.lastName || ''}.\n\nOriginariamente: ${originalFormattedDate} alle ${originalTimeStr}`,
            }),
          }
        );

        if (response.ok) {
          calendarUpdated = true;
          console.log(`✅ [RESCHEDULE BOOKING] Google Calendar event updated`);
        } else {
          console.error(`❌ [RESCHEDULE BOOKING] Failed to update Calendar event:`, await response.text());
        }
      }
    } catch (calendarError: any) {
      console.error(`❌ [RESCHEDULE BOOKING] Failed to update Calendar event:`, calendarError.message);
      // Continue even if calendar update fails - the consultation is rescheduled in DB
    }
  }

  const newFormattedDate = newScheduledAt.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const newTimeStr = newScheduledAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Clear booking flow state and refresh post-booking context (for further modify/cancel)
  if (conversationId) {
    try {
      await clearBookingFlowState(conversationId);
      // Refresh post-booking context with same consultation ID (new 30-min window)
      await setPostBookingContext(conversationId, consultation.id);
      console.log(`🧹 [RESCHEDULE BOOKING] Cleared booking flow state and refreshed post-booking context for consultation ${consultation.id}`);
    } catch (flowError) {
      console.warn(`⚠️ [RESCHEDULE BOOKING] Failed to update flow/post-booking state:`, flowError);
    }
  }

  // Build appropriate message based on calendar update status
  let message = `Ho spostato la consulenza dal ${originalFormattedDate} alle ${originalTimeStr} → ${newFormattedDate} alle ${newTimeStr}.`;
  if (consultation.googleCalendarEventId) {
    message += calendarUpdated 
      ? ' Il calendario è stato aggiornato automaticamente.' 
      : ' (Nota: non sono riuscito ad aggiornare il calendario Google, potrebbe essere necessario aggiornarlo manualmente.)';
  }

  return {
    toolName: "rescheduleBooking",
    args,
    result: {
      success: true,
      rescheduled: true,
      original: {
        date: originalFormattedDate,
        time: originalTimeStr
      },
      new: {
        id: consultation.id,
        date: newFormattedDate,
        time: newTimeStr,
        duration: consultation.duration || 60
      },
      calendarUpdated,
      message,
      next_action_hint: "confirm_reschedule"
    },
    success: true
  };
}
