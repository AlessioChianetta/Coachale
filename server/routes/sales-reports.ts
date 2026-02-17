import { Router } from "express";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { db } from "../db";
import { dailySalesReports } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getAIProvider } from "../ai/provider-factory";

const router = Router();

router.get("/sales-reports/:date", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { date } = req.params;

    const [report] = await db
      .select()
      .from(dailySalesReports)
      .where(and(eq(dailySalesReports.userId, userId), eq(dailySalesReports.date, date)))
      .limit(1);

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sales-reports", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const reports = await db
      .select()
      .from(dailySalesReports)
      .where(
        and(
          eq(dailySalesReports.userId, userId),
          gte(dailySalesReports.date, startDate as string),
          lte(dailySalesReports.date, endDate as string)
        )
      );

    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sales-reports", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultantId = req.user!.consultantId || req.user!.id;
    const { date, calls, discoBooked, discoScheduled, discoShowed, demoBooked, demoScheduled, demoShowed, depositsAmount, contractsClosed, contractsAmount, notes } = req.body;

    if (!date) {
      return res.status(400).json({ error: "date is required" });
    }

    const [existing] = await db
      .select()
      .from(dailySalesReports)
      .where(and(eq(dailySalesReports.userId, userId), eq(dailySalesReports.date, date)))
      .limit(1);

    let report;
    if (existing) {
      [report] = await db
        .update(dailySalesReports)
        .set({
          calls: calls ?? 0,
          discoBooked: discoBooked ?? 0,
          discoScheduled: discoScheduled ?? 0,
          discoShowed: discoShowed ?? 0,
          demoBooked: demoBooked ?? 0,
          demoScheduled: demoScheduled ?? 0,
          demoShowed: demoShowed ?? 0,
          depositsAmount: String(depositsAmount ?? "0"),
          contractsClosed: contractsClosed ?? 0,
          contractsAmount: String(contractsAmount ?? "0"),
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(dailySalesReports.id, existing.id))
        .returning();
    } else {
      [report] = await db
        .insert(dailySalesReports)
        .values({
          userId,
          consultantId,
          date,
          calls: calls ?? 0,
          discoBooked: discoBooked ?? 0,
          discoScheduled: discoScheduled ?? 0,
          discoShowed: discoShowed ?? 0,
          demoBooked: demoBooked ?? 0,
          demoScheduled: demoScheduled ?? 0,
          demoShowed: demoShowed ?? 0,
          depositsAmount: String(depositsAmount ?? "0"),
          contractsClosed: contractsClosed ?? 0,
          contractsAmount: String(contractsAmount ?? "0"),
          notes: notes || null,
        })
        .returning();
    }

    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sales-reports/ai-analyze", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const consultantId = req.user!.consultantId || req.user!.id;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const reports = await db
      .select()
      .from(dailySalesReports)
      .where(
        and(
          eq(dailySalesReports.userId, userId),
          gte(dailySalesReports.date, startDate),
          lte(dailySalesReports.date, endDate)
        )
      );

    const totals = {
      calls: 0, discoBooked: 0, discoScheduled: 0, discoShowed: 0,
      demoBooked: 0, demoScheduled: 0, demoShowed: 0,
      depositsAmount: 0, contractsClosed: 0, contractsAmount: 0,
      daysWithData: reports.length,
    };

    for (const r of reports) {
      totals.calls += r.calls;
      totals.discoBooked += r.discoBooked;
      totals.discoScheduled += r.discoScheduled;
      totals.discoShowed += r.discoShowed;
      totals.demoBooked += r.demoBooked;
      totals.demoScheduled += r.demoScheduled;
      totals.demoShowed += r.demoShowed;
      totals.depositsAmount += parseFloat(r.depositsAmount || "0");
      totals.contractsClosed += r.contractsClosed;
      totals.contractsAmount += parseFloat(r.contractsAmount || "0");
    }

    const conversionRates = {
      callsToDisco: totals.calls > 0 ? ((totals.discoBooked / totals.calls) * 100).toFixed(1) : "0",
      discoShowRate: totals.discoScheduled > 0 ? ((totals.discoShowed / totals.discoScheduled) * 100).toFixed(1) : "0",
      demoShowRate: totals.demoScheduled > 0 ? ((totals.demoShowed / totals.demoScheduled) * 100).toFixed(1) : "0",
      demoToContract: totals.demoShowed > 0 ? ((totals.contractsClosed / totals.demoShowed) * 100).toFixed(1) : "0",
    };

    const daysWithoutReport: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const reportDates = new Set(reports.map(r => r.date));
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0) {
        const dateStr = d.toISOString().split('T')[0];
        if (!reportDates.has(dateStr)) {
          daysWithoutReport.push(dateStr);
        }
      }
    }

    const prompt = `Sei un coach di vendita esperto. Analizza questi dati di vendita del periodo ${startDate} - ${endDate} e dai un feedback costruttivo in italiano.

DATI PERIODO:
- Giorni con dati: ${totals.daysWithData}
- Giorni senza report (escluse domeniche): ${daysWithoutReport.length} ${daysWithoutReport.length > 0 ? `(${daysWithoutReport.join(', ')})` : ''}

TOTALI:
- Call effettuate: ${totals.calls}
- Discovery prenotate: ${totals.discoBooked}
- Discovery programmate: ${totals.discoScheduled}
- Discovery presentati: ${totals.discoShowed}
- Demo prenotate: ${totals.demoBooked}
- Demo programmate: ${totals.demoScheduled}
- Demo presentati: ${totals.demoShowed}
- Depositi: €${totals.depositsAmount.toFixed(2)}
- Contratti chiusi: ${totals.contractsClosed}
- Importo contratti: €${totals.contractsAmount.toFixed(2)}

TASSI DI CONVERSIONE:
- Call → Discovery prenotate: ${conversionRates.callsToDisco}%
- Discovery show rate: ${conversionRates.discoShowRate}%
- Demo show rate: ${conversionRates.demoShowRate}%
- Demo → Contratti: ${conversionRates.demoToContract}%

DETTAGLIO GIORNALIERO:
${reports.map(r => `${r.date}: Call=${r.calls}, DiscoBook=${r.discoBooked}, DiscoProg=${r.discoScheduled}, DiscoShow=${r.discoShowed}, DemoBook=${r.demoBooked}, DemoProg=${r.demoScheduled}, DemoShow=${r.demoShowed}, Dep=€${r.depositsAmount}, Contratti=${r.contractsClosed} (€${r.contractsAmount})`).join('\n')}

Rispondi con:
1. Un breve riepilogo delle performance
2. Punti di forza identificati
3. Aree di miglioramento con suggerimenti specifici
4. Se ci sono giorni mancanti, segnalalo
5. Obiettivi suggeriti per il prossimo periodo
6. Un messaggio motivazionale

Usa un tono professionale ma incoraggiante. Sii specifico con i numeri.`;

    const { client, metadata } = await getAIProvider(userId, consultantId);
    const result = await client.generateContent({
      model: metadata.model || "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    });

    const responseText = result.response.text();

    res.json({
      analysis: responseText,
      totals,
      conversionRates,
      daysWithoutReport,
    });
  } catch (error: any) {
    console.error("❌ [SALES AI] Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
