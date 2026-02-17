import { Router, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { AuthRequest, authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

function getDateRange(period?: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();

  let start: Date;
  let end: Date;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = now;
      break;
    case "day":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = now;
      break;
    case "week":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      end = now;
      break;
    case "custom":
      start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
      if (to) {
        end = new Date(to);
        end.setHours(23, 59, 59, 999);
      } else {
        end = now;
      }
      break;
    case "month":
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
  }

  return { start, end };
}

router.get("/summary", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const summaryResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
        COUNT(*)::text AS "requestCount"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
    `);

    const summary = summaryResult.rows[0] as any;
    const totalTokens = parseInt(summary.totalTokens) || 0;
    const totalCost = parseFloat(summary.totalCost) || 0;
    const requestCount = parseInt(summary.requestCount) || 0;
    const avgCostPerRequest = requestCount > 0 ? totalCost / requestCount : 0;

    const topFeaturesResult = await db.execute(sql`
      SELECT
        feature,
        COUNT(*)::text AS "requestCount",
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY feature
      ORDER BY SUM(total_cost::numeric) DESC
      LIMIT 10
    `);

    const costByModelResult = await db.execute(sql`
      SELECT
        model,
        COUNT(*)::text AS "requestCount",
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY model
      ORDER BY SUM(total_cost::numeric) DESC
    `);

    const dailyTrendResult = await db.execute(sql`
      SELECT
        created_at::date::text AS "date",
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
        COUNT(*)::text AS "requestCount"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY created_at::date
      ORDER BY created_at::date ASC
    `);

    res.json({
      totalTokens,
      totalCost,
      requestCount,
      avgCostPerRequest,
      topFeatures: (topFeaturesResult.rows as any[]).map(r => ({
        feature: r.feature,
        requestCount: parseInt(r.requestCount) || 0,
        totalTokens: parseInt(r.totalTokens) || 0,
        totalCost: parseFloat(r.totalCost) || 0,
      })),
      costByModel: (costByModelResult.rows as any[]).map(r => ({
        model: r.model,
        requestCount: parseInt(r.requestCount) || 0,
        totalTokens: parseInt(r.totalTokens) || 0,
        totalCost: parseFloat(r.totalCost) || 0,
      })),
      dailyTrend: (dailyTrendResult.rows as any[]).map(r => ({
        date: r.date,
        totalTokens: parseInt(r.totalTokens) || 0,
        totalCost: parseFloat(r.totalCost) || 0,
        requestCount: parseInt(r.requestCount) || 0,
      })),
    });
  } catch (error) {
    console.error("[AI Usage] Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch AI usage summary" });
  }
});

router.get("/by-client", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const result = await db.execute(sql`
      WITH usage_data AS (
        SELECT
          t.client_id AS client_id,
          CASE 
            WHEN t.client_id IS NULL OR t.client_id = '' OR t.client_id = t.consultant_id THEN cu.first_name || ' ' || cu.last_name
            ELSE u.first_name || ' ' || u.last_name
          END AS user_name,
          CASE 
            WHEN t.client_id IS NULL OR t.client_id = '' OR t.client_id = t.consultant_id THEN 'consultant'
            ELSE 'client'
          END AS client_role,
          COALESCE(SUM(t.total_tokens), 0) AS total_tokens,
          COALESCE(SUM(t.total_cost::numeric), 0) AS total_cost,
          COUNT(*) AS request_count,
          MAX(t.created_at)::text AS last_used,
          (SELECT feature FROM ai_token_usage t2
           WHERE t2.consultant_id = ${consultantId}
             AND t2.created_at >= ${start}
             AND t2.created_at <= ${end}
             AND (
               ((t2.client_id IS NULL OR t2.client_id = '' OR t2.client_id = t2.consultant_id) AND (t.client_id IS NULL OR t.client_id = '' OR t.client_id = t.consultant_id))
               OR t2.client_id = t.client_id
             )
           GROUP BY feature
           ORDER BY COUNT(*) DESC
           LIMIT 1
          ) AS top_feature
        FROM ai_token_usage t
        LEFT JOIN users u ON t.client_id = u.id
        LEFT JOIN users cu ON t.consultant_id = cu.id
        WHERE t.consultant_id = ${consultantId}
          AND t.created_at >= ${start}
          AND t.created_at <= ${end}
          AND (t.client_id IS NULL OR t.client_id = '' OR t.client_id = t.consultant_id OR u.is_active = true)
        GROUP BY t.client_id, u.first_name, u.last_name, cu.first_name, cu.last_name
      ),
      active_clients AS (
        SELECT
          ac.id AS client_id,
          ac.first_name || ' ' || ac.last_name AS user_name,
          'client' AS client_role
        FROM users ac
        WHERE ac.consultant_id = ${consultantId}
          AND ac.role IN ('client', 'consultant')
          AND ac.is_active = true
          AND ac.id NOT IN (SELECT ud.client_id FROM usage_data ud WHERE ud.client_id IS NOT NULL)
      )
      SELECT * FROM (
        SELECT
          client_id AS "clientId",
          user_name AS "userName",
          client_role AS "clientRole",
          total_tokens::text AS "totalTokens",
          total_cost::text AS "totalCost",
          request_count::text AS "requestCount",
          last_used AS "lastUsed",
          top_feature AS "topFeature"
        FROM usage_data
        UNION ALL
        SELECT
          client_id AS "clientId",
          user_name AS "userName",
          client_role AS "clientRole",
          '0' AS "totalTokens",
          '0' AS "totalCost",
          '0' AS "requestCount",
          NULL AS "lastUsed",
          NULL AS "topFeature"
        FROM active_clients
      ) combined
      ORDER BY "totalCost"::numeric DESC NULLS LAST
    `);

    res.json((result.rows as any[]).map(r => ({
      clientId: r.clientId,
      clientName: r.userName || "Sconosciuto",
      clientRole: r.clientRole,
      totalTokens: parseInt(r.totalTokens) || 0,
      totalCost: parseFloat(r.totalCost) || 0,
      requestCount: parseInt(r.requestCount) || 0,
      topFeature: r.topFeature || null,
      lastUsed: r.lastUsed,
    })));
  } catch (error) {
    console.error("[AI Usage] Error fetching by-client:", error);
    res.status(500).json({ error: "Failed to fetch AI usage by client" });
  }
});

router.get("/by-client/:clientId/features", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { clientId } = req.params;
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const isSelf = clientId === 'self';
    
    const result = await db.execute(sql`
      SELECT
        feature,
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
        COUNT(*)::text AS "requestCount"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
        AND ${isSelf ? sql`(client_id IS NULL OR client_id = '' OR client_id = ${consultantId})` : sql`client_id = ${clientId}`}
      GROUP BY feature
      ORDER BY SUM(total_cost::numeric) DESC
    `);

    res.json((result.rows as any[]).map(r => ({
      feature: r.feature,
      totalTokens: parseInt(r.totalTokens) || 0,
      totalCost: parseFloat(r.totalCost) || 0,
      requestCount: parseInt(r.requestCount) || 0,
    })));
  } catch (error) {
    console.error("[AI Usage] Error fetching user features:", error);
    res.status(500).json({ error: "Failed to fetch user feature breakdown" });
  }
});

router.get("/by-feature", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const result = await db.execute(sql`
      WITH totals AS (
        SELECT COALESCE(SUM(total_cost::numeric), 0) AS grand_total
        FROM ai_token_usage
        WHERE consultant_id = ${consultantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
      )
      SELECT
        feature,
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
        COUNT(*)::text AS "requestCount",
        CASE WHEN (SELECT grand_total FROM totals) > 0
          THEN ROUND(SUM(total_cost::numeric) / (SELECT grand_total FROM totals) * 100, 2)::text
          ELSE '0'
        END AS "percentOfTotal",
        CASE WHEN COUNT(*) > 0
          THEN ROUND(SUM(total_tokens)::numeric / COUNT(*), 0)::text
          ELSE '0'
        END AS "avgTokensPerRequest",
        COALESCE(SUM(CASE WHEN client_id IS NULL OR client_id = '' OR client_id = consultant_id THEN total_tokens ELSE 0 END), 0)::text AS "consultantTokens",
        COALESCE(SUM(CASE WHEN client_id IS NULL OR client_id = '' OR client_id = consultant_id THEN total_cost::numeric ELSE 0 END), 0)::text AS "consultantCost",
        COALESCE(SUM(CASE WHEN client_id IS NULL OR client_id = '' OR client_id = consultant_id THEN 1 ELSE 0 END), 0)::text AS "consultantRequests",
        COALESCE(SUM(CASE WHEN client_id IS NOT NULL AND client_id != '' AND client_id != consultant_id THEN total_tokens ELSE 0 END), 0)::text AS "clientTokens",
        COALESCE(SUM(CASE WHEN client_id IS NOT NULL AND client_id != '' AND client_id != consultant_id THEN total_cost::numeric ELSE 0 END), 0)::text AS "clientCost",
        COALESCE(SUM(CASE WHEN client_id IS NOT NULL AND client_id != '' AND client_id != consultant_id THEN 1 ELSE 0 END), 0)::text AS "clientRequests"
      FROM ai_token_usage
      WHERE consultant_id = ${consultantId}
        AND created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY feature
      ORDER BY SUM(total_cost::numeric) DESC
    `);

    res.json((result.rows as any[]).map(r => ({
      feature: r.feature,
      totalTokens: parseInt(r.totalTokens) || 0,
      totalCost: parseFloat(r.totalCost) || 0,
      requestCount: parseInt(r.requestCount) || 0,
      percentOfTotal: parseFloat(r.percentOfTotal) || 0,
      avgTokensPerRequest: parseInt(r.avgTokensPerRequest) || 0,
      consultantTokens: parseInt(r.consultantTokens) || 0,
      consultantCost: parseFloat(r.consultantCost) || 0,
      consultantRequests: parseInt(r.consultantRequests) || 0,
      clientTokens: parseInt(r.clientTokens) || 0,
      clientCost: parseFloat(r.clientCost) || 0,
      clientRequests: parseInt(r.clientRequests) || 0,
    })));
  } catch (error) {
    console.error("[AI Usage] Error fetching by-feature:", error);
    res.status(500).json({ error: "Failed to fetch AI usage by feature" });
  }
});

router.get("/timeline", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const consultantId = req.user!.id;
    const { period, from, to, granularity } = req.query as { period?: string; from?: string; to?: string; granularity?: string };
    const { start, end } = getDateRange(period, from, to);

    let result;
    if (granularity === "hour") {
      result = await db.execute(sql`
        SELECT
          to_char(created_at, 'YYYY-MM-DD HH24:00') AS "date",
          COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
          COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
          COUNT(*)::text AS "requestCount"
        FROM ai_token_usage
        WHERE consultant_id = ${consultantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY to_char(created_at, 'YYYY-MM-DD HH24:00')
        ORDER BY to_char(created_at, 'YYYY-MM-DD HH24:00') ASC
      `);
    } else if (granularity === "week") {
      result = await db.execute(sql`
        SELECT
          to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS "date",
          COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
          COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
          COUNT(*)::text AS "requestCount"
        FROM ai_token_usage
        WHERE consultant_id = ${consultantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY date_trunc('week', created_at)
        ORDER BY date_trunc('week', created_at) ASC
      `);
    } else if (granularity === "month") {
      result = await db.execute(sql`
        SELECT
          to_char(date_trunc('month', created_at), 'YYYY-MM') AS "date",
          COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
          COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
          COUNT(*)::text AS "requestCount"
        FROM ai_token_usage
        WHERE consultant_id = ${consultantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at) ASC
      `);
    } else {
      result = await db.execute(sql`
        SELECT
          created_at::date::text AS "date",
          COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
          COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
          COUNT(*)::text AS "requestCount"
        FROM ai_token_usage
        WHERE consultant_id = ${consultantId}
          AND created_at >= ${start}
          AND created_at <= ${end}
        GROUP BY created_at::date
        ORDER BY created_at::date ASC
      `);
    }

    res.json((result.rows as any[]).map(r => ({
      date: r.date,
      totalTokens: parseInt(r.totalTokens) || 0,
      totalCost: parseFloat(r.totalCost) || 0,
      requestCount: parseInt(r.requestCount) || 0,
    })));
  } catch (error) {
    console.error("[AI Usage] Error fetching timeline:", error);
    res.status(500).json({ error: "Failed to fetch AI usage timeline" });
  }
});

router.get("/all-consultants", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const result = await db.execute(sql`
      SELECT
        t.consultant_id AS "consultantId",
        u.first_name || ' ' || u.last_name AS "consultantName",
        COALESCE(SUM(t.total_tokens), 0)::text AS "totalTokens",
        COALESCE(SUM(t.total_cost::numeric), 0)::text AS "totalCost",
        COUNT(DISTINCT t.client_id)::text AS "clientCount",
        MODE() WITHIN GROUP (ORDER BY t.key_source) AS "keySource",
        (SELECT feature FROM ai_token_usage t2
         WHERE t2.consultant_id = t.consultant_id
           AND t2.created_at >= ${start}
           AND t2.created_at <= ${end}
         GROUP BY feature
         ORDER BY COUNT(*) DESC
         LIMIT 1
        ) AS "topFeature"
      FROM ai_token_usage t
      LEFT JOIN users u ON t.consultant_id = u.id
      WHERE t.created_at >= ${start}
        AND t.created_at <= ${end}
      GROUP BY t.consultant_id, u.first_name, u.last_name
      ORDER BY SUM(t.total_cost::numeric) DESC
    `);

    res.json((result.rows as any[]).map(r => ({
      consultantId: r.consultantId,
      consultantName: r.consultantName || "Unknown",
      totalTokens: parseInt(r.totalTokens) || 0,
      totalCost: parseFloat(r.totalCost) || 0,
      clientCount: parseInt(r.clientCount) || 0,
      topFeature: r.topFeature || null,
      keySource: r.keySource || "unknown",
    })));
  } catch (error) {
    console.error("[AI Usage] Error fetching all-consultants:", error);
    res.status(500).json({ error: "Failed to fetch all consultants AI usage" });
  }
});

router.get("/platform-summary", authenticateToken, requireRole("super_admin"), async (req: AuthRequest, res: Response) => {
  try {
    const { period, from, to } = req.query as { period?: string; from?: string; to?: string };
    const { start, end } = getDateRange(period, from, to);

    const summaryResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalPlatformCost",
        COALESCE(SUM(total_tokens), 0)::text AS "totalTokens",
        COUNT(DISTINCT consultant_id)::text AS "consultantCount"
      FROM ai_token_usage
      WHERE created_at >= ${start}
        AND created_at <= ${end}
    `);

    const summary = summaryResult.rows[0] as any;

    const costByKeySourceResult = await db.execute(sql`
      SELECT
        key_source AS "keySource",
        COALESCE(SUM(total_cost::numeric), 0)::text AS "totalCost",
        COUNT(*)::text AS "requestCount"
      FROM ai_token_usage
      WHERE created_at >= ${start}
        AND created_at <= ${end}
      GROUP BY key_source
      ORDER BY SUM(total_cost::numeric) DESC
    `);

    const topConsumersResult = await db.execute(sql`
      SELECT
        t.consultant_id AS "consultantId",
        u.first_name || ' ' || u.last_name AS "consultantName",
        COALESCE(SUM(t.total_cost::numeric), 0)::text AS "totalCost",
        COALESCE(SUM(t.total_tokens), 0)::text AS "totalTokens"
      FROM ai_token_usage t
      LEFT JOIN users u ON t.consultant_id = u.id
      WHERE t.created_at >= ${start}
        AND t.created_at <= ${end}
      GROUP BY t.consultant_id, u.first_name, u.last_name
      ORDER BY SUM(t.total_cost::numeric) DESC
      LIMIT 10
    `);

    res.json({
      totalPlatformCost: parseFloat(summary.totalPlatformCost) || 0,
      totalTokens: parseInt(summary.totalTokens) || 0,
      consultantCount: parseInt(summary.consultantCount) || 0,
      costByKeySource: (costByKeySourceResult.rows as any[]).map(r => ({
        keySource: r.keySource,
        totalCost: parseFloat(r.totalCost) || 0,
        requestCount: parseInt(r.requestCount) || 0,
      })),
      topConsumers: (topConsumersResult.rows as any[]).map(r => ({
        consultantId: r.consultantId,
        consultantName: r.consultantName || "Unknown",
        totalCost: parseFloat(r.totalCost) || 0,
        totalTokens: parseInt(r.totalTokens) || 0,
      })),
    });
  } catch (error) {
    console.error("[AI Usage] Error fetching platform-summary:", error);
    res.status(500).json({ error: "Failed to fetch platform summary" });
  }
});

export default router;
