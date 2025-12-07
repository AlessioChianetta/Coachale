import { Router } from "express";
import { db } from "../../db";
import { videoMeetings, videoMeetingParticipants, humanSellers, salesScripts } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const router = Router();

router.get("/:meetingToken", async (req, res) => {
  try {
    const { meetingToken } = req.params;

    console.log(`[PublicMeeting] Fetching meeting for token: ${meetingToken}`);

    const [meeting] = await db
      .select()
      .from(videoMeetings)
      .where(eq(videoMeetings.meetingToken, meetingToken))
      .limit(1);

    if (!meeting) {
      return res.status(404).json({ message: "Meeting non trovato" });
    }

    if (meeting.status === 'cancelled') {
      return res.status(403).json({ message: "Questo meeting è stato cancellato" });
    }

    if (meeting.status === 'completed') {
      return res.status(410).json({ message: "Questo meeting è già terminato" });
    }

    let seller = null;
    if (meeting.sellerId) {
      const [sellerData] = await db
        .select({
          id: humanSellers.id,
          name: humanSellers.name,
          email: humanSellers.email,
          defaultScriptId: humanSellers.defaultScriptId,
        })
        .from(humanSellers)
        .where(eq(humanSellers.id, meeting.sellerId))
        .limit(1);

      seller = sellerData || null;
    }

    let script = null;
    const scriptId = meeting.playbookId || seller?.defaultScriptId;

    if (scriptId) {
      const [scriptData] = await db
        .select({
          id: salesScripts.id,
          name: salesScripts.name,
          scriptType: salesScripts.scriptType,
          version: salesScripts.version,
          content: salesScripts.content,
          structure: salesScripts.structure,
        })
        .from(salesScripts)
        .where(eq(salesScripts.id, scriptId))
        .limit(1);

      if (scriptData) {
        script = {
          id: scriptData.id,
          name: scriptData.name,
          scriptType: scriptData.scriptType,
          version: scriptData.version || '1.0',
          structure: scriptData.structure,
        };
      }
    }

    const participantsData = await db
      .select()
      .from(videoMeetingParticipants)
      .where(and(
        eq(videoMeetingParticipants.meetingId, meeting.id),
        isNull(videoMeetingParticipants.leftAt)
      ));

    const participants = participantsData.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      joinedAt: p.joinedAt?.toISOString(),
    }));

    console.log(`[PublicMeeting] Meeting found: ${meeting.id} - ${meeting.prospectName}`);

    res.json({
      meeting: {
        id: meeting.id,
        sellerId: meeting.sellerId,
        meetingToken: meeting.meetingToken,
        prospectName: meeting.prospectName,
        prospectEmail: meeting.prospectEmail,
        playbookId: meeting.playbookId,
        scheduledAt: meeting.scheduledAt?.toISOString(),
        startedAt: meeting.startedAt?.toISOString(),
        endedAt: meeting.endedAt?.toISOString(),
        status: meeting.status,
      },
      seller: seller ? {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        defaultScriptId: seller.defaultScriptId,
      } : null,
      script,
      participants,
    });
  } catch (error: any) {
    console.error(`[PublicMeeting] Error:`, error);
    res.status(500).json({
      message: "Errore durante il recupero del meeting",
      error: error.message,
    });
  }
});

export default router;
