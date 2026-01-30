/**
 * Consultation Tool Executor
 * Handles execution of consultation-related function calls from the AI
 */

import { db } from "../db";
import { consultations, users, consultantClients, consultantAvailabilitySettings } from "@shared/schema";
import { eq, and, gte, lte, sql, or, desc } from "drizzle-orm";
import { ConsultationToolResult } from "./consultation-tools";
import crypto from "crypto";
import { getValidAccessToken, createGoogleCalendarEvent } from "../google-calendar-service";

const pendingBookings = new Map<string, {
  clientId: string;
  consultantId: string;
  date: string;
  time: string;
  duration: number;
  notes?: string;
  expiresAt: Date;
}>();

setInterval(() => {
  const now = new Date();
  for (const [token, booking] of pendingBookings.entries()) {
    if (booking.expiresAt < now) {
      pendingBookings.delete(token);
    }
  }
}, 60000);

export async function executeConsultationTool(
  toolName: string,
  args: Record<string, any>,
  clientId: string,
  consultantId: string
): Promise<ConsultationToolResult> {
  console.log(`🔧 [CONSULTATION TOOL] Executing ${toolName} for client ${clientId.slice(0, 8)}`);
  console.log(`   Args:`, JSON.stringify(args));

  try {
    switch (toolName) {
      case "getConsultationStatus":
        return await executeGetConsultationStatus(clientId, consultantId, args);
      case "getAvailableSlots":
        return await executeGetAvailableSlots(clientId, consultantId, args);
      case "proposeBooking":
        return await executeProposeBooking(clientId, consultantId, args);
      case "confirmBooking":
        return await executeConfirmBooking(clientId, args);
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
  }
): Promise<ConsultationToolResult> {
  const now = new Date();
  
  // Load consultant availability settings from DB
  const [settings] = await db
    .select()
    .from(consultantAvailabilitySettings)
    .where(eq(consultantAvailabilitySettings.consultantId, consultantId))
    .limit(1);

  // Default config if not configured
  const appointmentDuration = settings?.appointmentDuration || 60;
  const bufferBefore = settings?.bufferBefore || 15;
  const bufferAfter = settings?.bufferAfter || 15;
  const minHoursNotice = settings?.minHoursNotice || 24;
  const maxDaysAhead = settings?.maxDaysAhead || 30;
  const timezone = settings?.timezone || "Europe/Rome";
  
  // Parse appointmentAvailability from DB or use defaults (lun-ven 9-18)
  type DayAvailability = { enabled: boolean; start: string; end: string };
  const availabilityConfig: Record<string, DayAvailability> = {};
  
  if (settings?.appointmentAvailability && typeof settings.appointmentAvailability === 'object') {
    const rawConfig = settings.appointmentAvailability as Record<string, any>;
    for (const [dayId, config] of Object.entries(rawConfig)) {
      if (config && typeof config === 'object' && 'enabled' in config) {
        availabilityConfig[dayId] = config as DayAvailability;
      }
    }
  }
  
  // If no config, use defaults (Mon-Fri 9-18)
  if (Object.keys(availabilityConfig).length === 0) {
    for (let d = 1; d <= 5; d++) {
      availabilityConfig[d.toString()] = { enabled: true, start: "09:00", end: "18:00" };
    }
    availabilityConfig["0"] = { enabled: false, start: "09:00", end: "18:00" };
    availabilityConfig["6"] = { enabled: false, start: "09:00", end: "18:00" };
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

  // Try to get Google Calendar events if connected
  let calendarBusy: Array<{ start: Date; end: Date }> = [];
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
            calendarBusy.push({
              start: new Date(event.start.dateTime),
              end: new Date(event.end.dateTime)
            });
          }
        }
      }
      console.log(`📅 [SLOTS] Loaded ${calendarBusy.length} events from Google Calendar`);
    }
  } catch (error) {
    console.log(`⚠️ [SLOTS] Could not load Google Calendar (not connected or error):`, error);
  }

  // Merge all busy ranges
  const allBusyRanges = [...busyRanges, ...calendarBusy];

  // Helper to check if a slot conflicts with busy ranges
  const isSlotBusy = (slotStart: Date, slotEnd: Date): boolean => {
    for (const busy of allBusyRanges) {
      if (slotStart < busy.end && slotEnd > busy.start) {
        return true;
      }
    }
    return false;
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

  const current = new Date(effectiveStartDate);
  current.setHours(0, 0, 0, 0);

  while (current <= effectiveEndDate && availableSlots.length < 20) {
    const dayOfWeek = current.getDay();
    const dayName = dayNames[dayOfWeek];
    const dayConfig = availabilityConfig[dayOfWeek.toString()];

    // Only process enabled days
    if (dayConfig?.enabled) {
      // Check if this day matches preferred day filter
      if (!args.preferredDayOfWeek || args.preferredDayOfWeek.toLowerCase() === dayName) {
        // Parse day's available hours
        const [startHour, startMin] = (dayConfig.start || "09:00").split(':').map(Number);
        const [endHour, endMin] = (dayConfig.end || "18:00").split(':').map(Number);
        
        // Generate slots based on appointment duration
        let slotStartHour = startHour;
        let slotStartMin = startMin;
        
        // Apply preferred time range filter
        if (args.preferredTimeRange) {
          const range = workingHours[args.preferredTimeRange as keyof typeof workingHours];
          if (range) {
            slotStartHour = Math.max(slotStartHour, range.start);
          }
        }

        while (slotStartHour < endHour || (slotStartHour === endHour && slotStartMin < endMin)) {
          const slotStart = new Date(current);
          slotStart.setHours(slotStartHour, slotStartMin, 0, 0);
          
          const slotEnd = new Date(slotStart.getTime() + appointmentDuration * 60 * 1000);
          
          // Check slot ends within working hours
          const slotEndHour = slotEnd.getHours();
          const slotEndMin = slotEnd.getMinutes();
          if (slotEndHour > endHour || (slotEndHour === endHour && slotEndMin > endMin)) {
            break;
          }
          
          // Check slot is in the future and respects minHoursNotice
          if (slotStart > minStartTime) {
            // Check against busy ranges (with buffer)
            const bufferedStart = new Date(slotStart.getTime() - bufferBefore * 60 * 1000);
            const bufferedEnd = new Date(slotEnd.getTime() + bufferAfter * 60 * 1000);
            
            if (!isSlotBusy(bufferedStart, bufferedEnd)) {
              availableSlots.push({
                date: slotStart.toISOString().slice(0, 10),
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
            }
          }
          
          // Move to next slot (every hour by default, or every 30 min for shorter appointments)
          const slotIncrement = appointmentDuration <= 30 ? 30 : 60;
          slotStartMin += slotIncrement;
          if (slotStartMin >= 60) {
            slotStartHour += Math.floor(slotStartMin / 60);
            slotStartMin = slotStartMin % 60;
          }
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const calendarConnected = !!(settings?.googleRefreshToken);
  
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
  args: { date: string; time: string; duration?: number; notes?: string }
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

  const confirmationToken = crypto.randomBytes(16).toString('hex');
  pendingBookings.set(confirmationToken, {
    clientId,
    consultantId,
    date: args.date,
    time: args.time,
    duration: args.duration || 60,
    notes: args.notes,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

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
      message: `Ho preparato la prenotazione per ${proposedDateTime.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${args.time}. Confermi?`,
      expiresIn: "10 minuti"
    },
    success: true
  };
}

async function executeConfirmBooking(
  clientId: string,
  args: { confirmationToken: string }
): Promise<ConsultationToolResult> {
  // Guardrail: validate required token
  if (!args.confirmationToken) {
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
  
  const pendingBooking = pendingBookings.get(args.confirmationToken);

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

  if (pendingBooking.expiresAt < new Date()) {
    pendingBookings.delete(args.confirmationToken);
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

  const scheduledAt = new Date(`${pendingBooking.date}T${pendingBooking.time}:00`);

  const [newConsultation] = await db
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

  pendingBookings.delete(args.confirmationToken);

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
      const consultantName = consultantInfo ? `${consultantInfo.firstName || ''} ${consultantInfo.lastName || ''}`.trim() : 'Consulente';
      const attendees = [clientInfo?.email, consultantInfo?.email].filter(Boolean) as string[];

      console.log(`📅 [CONSULTATION TOOL] Creating Google Calendar event for consultation ${newConsultation.id}...`);

      const calendarResult = await createGoogleCalendarEvent(
        pendingBooking.consultantId,
        {
          summary: `Consulenza con ${clientName}`,
          description: `Consulenza prenotata tramite AI Assistant.\n\nNote: ${pendingBooking.notes || 'Nessuna nota'}`,
          startDate: pendingBooking.date,
          startTime: pendingBooking.time,
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

  let message = `Perfetto! Ho confermato la tua consulenza per ${formattedDate} alle ${pendingBooking.time}.`;
  if (googleMeetLink) {
    message += ` Ti ho inviato l'invito al calendario con il link per la videochiamata.`;
  } else {
    message += ` Riceverai presto i dettagli per la videochiamata.`;
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
        time: pendingBooking.time,
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
