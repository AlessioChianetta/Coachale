import { Router, Request, Response } from "express";
import { getConsultantBySlug, getPublicAvailableSlots, createPublicBooking, generateBookingSlug } from "../booking/booking-service";
import { db } from "../db";
import { consultantAvailabilitySettings, users } from "../../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    const consultant = await getConsultantBySlug(slug);
    
    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }
    
    if (!consultant.bookingPageEnabled) {
      return res.status(403).json({ error: "Pagina di prenotazione non attiva" });
    }
    
    res.json({
      consultantName: consultant.consultantName,
      consultantAvatar: consultant.consultantAvatar,
      title: consultant.bookingPageTitle || `Prenota una consulenza con ${consultant.consultantName}`,
      description: consultant.bookingPageDescription,
      appointmentDuration: consultant.appointmentDuration,
      timezone: consultant.timezone,
    });
  } catch (error: any) {
    console.error("[PUBLIC BOOKING] Error fetching consultant:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.get("/:slug/slots", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { startDate, endDate } = req.query;
    
    const consultant = await getConsultantBySlug(slug);
    
    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }
    
    if (!consultant.bookingPageEnabled) {
      return res.status(403).json({ error: "Pagina di prenotazione non attiva" });
    }
    
    const slots = await getPublicAvailableSlots(
      consultant.consultantId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      slots,
      appointmentDuration: consultant.appointmentDuration,
      timezone: consultant.timezone,
    });
  } catch (error: any) {
    console.error("[PUBLIC BOOKING] Error fetching slots:", error);
    res.status(500).json({ error: "Errore interno del server" });
  }
});

router.post("/:slug/book", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { date, time, clientName, clientEmail, clientPhone, notes } = req.body;
    
    if (!date || !time || !clientName || !clientEmail) {
      return res.status(400).json({ 
        error: "Dati mancanti. Inserisci data, orario, nome e email." 
      });
    }
    
    const consultant = await getConsultantBySlug(slug);
    
    if (!consultant) {
      return res.status(404).json({ error: "Consulente non trovato" });
    }
    
    if (!consultant.bookingPageEnabled) {
      return res.status(403).json({ error: "Pagina di prenotazione non attiva" });
    }
    
    const [hour, minute] = time.split(':').map(Number);
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hour, minute, 0, 0);
    
    if (scheduledAt < new Date()) {
      return res.status(400).json({ error: "Non puoi prenotare nel passato" });
    }
    
    // Verify the slot is actually available
    const requestedDate = new Date(date);
    const availableSlots = await getPublicAvailableSlots(
      consultant.consultantId,
      requestedDate,
      new Date(requestedDate.getTime() + 24 * 60 * 60 * 1000)
    );
    
    const isSlotAvailable = availableSlots.some(slot => {
      const slotDate = new Date(slot.start);
      return slotDate.getTime() === scheduledAt.getTime();
    });
    
    if (!isSlotAvailable) {
      return res.status(400).json({ 
        error: "Questo orario non è più disponibile. Seleziona un altro slot." 
      });
    }
    
    const result = await createPublicBooking({
      consultantId: consultant.consultantId,
      clientName,
      clientEmail,
      clientPhone,
      scheduledAt,
      duration: consultant.appointmentDuration || 60,
      notes,
    });
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    
    res.json({
      success: true,
      bookingId: result.bookingId,
      googleMeetLink: result.googleMeetLink,
      message: "Prenotazione confermata!",
      appointmentDetails: {
        date,
        time,
        duration: consultant.appointmentDuration,
        consultantName: consultant.consultantName,
      }
    });
  } catch (error: any) {
    console.error("[PUBLIC BOOKING] Error creating booking:", error);
    res.status(500).json({ error: "Errore durante la prenotazione" });
  }
});

export default router;
