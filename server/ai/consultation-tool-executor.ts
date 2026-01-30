/**
 * Consultation Tool Executor
 * Handles execution of consultation-related function calls from the AI
 */

import { db } from "../db";
import { consultations, users, consultantClients } from "@shared/schema";
import { eq, and, gte, lte, sql, or, desc } from "drizzle-orm";
import { ConsultationToolResult } from "./consultation-tools";
import crypto from "crypto";

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
  const startDate = args.startDate ? new Date(args.startDate) : now;
  const endDate = args.endDate ? new Date(args.endDate) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const existingConsultations = await db
    .select({
      scheduledAt: consultations.scheduledAt,
      duration: consultations.duration
    })
    .from(consultations)
    .where(
      and(
        eq(consultations.consultantId, consultantId),
        gte(consultations.scheduledAt, startDate),
        lte(consultations.scheduledAt, endDate),
        or(
          eq(consultations.status, "scheduled"),
          eq(consultations.status, "completed")
        )
      )
    );

  const busySlots = new Set(
    existingConsultations.map(c => 
      new Date(c.scheduledAt).toISOString().slice(0, 16)
    )
  );

  const workingHours = {
    mattina: { start: 9, end: 12 },
    pomeriggio: { start: 14, end: 18 },
    sera: { start: 18, end: 20 }
  };

  const dayMap: Record<string, number> = {
    "domenica": 0, "lunedì": 1, "martedì": 2, "mercoledì": 3,
    "giovedì": 4, "venerdì": 5, "sabato": 6
  };

  const availableSlots: Array<{
    date: string;
    dayOfWeek: string;
    time: string;
    dateFormatted: string;
  }> = [];

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  while (current <= endDate && availableSlots.length < 20) {
    const dayOfWeek = current.getDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dayNames = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
      const dayName = dayNames[dayOfWeek];

      if (!args.preferredDayOfWeek || args.preferredDayOfWeek === dayName) {
        let hoursToCheck: number[] = [];
        
        if (args.preferredTimeRange) {
          const range = workingHours[args.preferredTimeRange as keyof typeof workingHours];
          if (range) {
            for (let h = range.start; h < range.end; h++) {
              hoursToCheck.push(h);
            }
          }
        } else {
          hoursToCheck = [9, 10, 11, 14, 15, 16, 17];
        }

        for (const hour of hoursToCheck) {
          const slotDate = new Date(current);
          slotDate.setHours(hour, 0, 0, 0);

          if (slotDate > now) {
            const slotKey = slotDate.toISOString().slice(0, 16);
            
            if (!busySlots.has(slotKey)) {
              availableSlots.push({
                date: slotDate.toISOString().slice(0, 10),
                dayOfWeek: dayName,
                time: `${hour.toString().padStart(2, '0')}:00`,
                dateFormatted: slotDate.toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })
              });

              if (availableSlots.length >= 20) break;
            }
          }
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    toolName: "getAvailableSlots",
    args,
    result: {
      slots: availableSlots,
      count: availableSlots.length,
      message: availableSlots.length > 0
        ? `Ho trovato ${availableSlots.length} slot disponibili. Ecco i primi:`
        : "Non ho trovato slot disponibili nel periodo richiesto."
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
        duration: pendingBooking.duration
      },
      message: `Perfetto! Ho confermato la tua consulenza per ${scheduledAt.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} alle ${pendingBooking.time}. Riceverai una conferma.`
    },
    success: true
  };
}
